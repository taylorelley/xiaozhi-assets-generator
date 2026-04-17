# CLAUDE.md — xiaozhi-assets-generator

Guide for AI assistants working on this repository.

## What this repo is

Browser-based single-page app that lets users build a custom `assets.bin` (theme, fonts, emojis, wake-words, backgrounds) for LittleWise / XiaoZhi ESP32 devices. Everything — font conversion, wake-word model packing, SPIFFS image generation — runs client-side. Optionally talks to a device over WebSocket via MCP tools to flash the generated asset directly.

Part of a three-repo ecosystem:
- `xiaozhi-esp32` — firmware that consumes `assets.bin`
- `xiaozhi-esp32-server` — server + admin consoles
- `xiaozhi-assets-generator` — **this repo**

## Layout

```
web/                           # Vue 3 SPA root
├── index.html
├── package.json
├── vite.config.js             # base: /tools/assets-generator/ ; proxy /api → xiaozhi.me
├── tailwind.config.js
├── postcss.config.js
├── public/static/             # Preset resources served as-is
│   ├── charsets/              # GB2312, DeepSeek, Latin1, Qwen glyph sets
│   ├── fonts/                 # Puhui 14/16/20/30px presets
│   ├── emojis/                # Twemoji 32/64, Noto 128
│   ├── wakenet_model/         # 68 WakeNet9 / 9s packages
│   └── multinet_model/        # MultiNet6/7 custom-phrase models
└── src/
    ├── main.js                # Vue app + i18n + router bootstrap
    ├── App.vue                # Header, DeviceStatus, LanguageSelector, <router-view/>
    ├── router/index.js        # Single route "/" → HomePage
    ├── views/HomePage.vue     # 3-step wizard
    ├── components/
    │   ├── ChipConfig.vue     # Step 1: chip/display/resolution
    │   ├── ThemeDesign.vue    # Step 2: wakeword / font / emoji / background tabs
    │   ├── GenerateModal.vue  # Step 3: manifest preview + generate/flash
    │   ├── DeviceStatus.vue   # MCP connectivity indicator
    │   ├── LanguageSelector.vue
    │   ├── icons/             # 6 SVG icons
    │   └── tabs/              # WakewordConfig, FontConfig, EmojiConfig, BackgroundConfig
    ├── composables/
    │   └── useDeviceStatus.js # MCP polling (5s retry)
    ├── locales/               # en, zh-CN, zh-TW, ja, vi
    └── utils/
        ├── AssetsBuilder.js       # Orchestrator (≈1500 lines)
        ├── SpiffsGenerator.js     # Packs final assets.bin (SPIFFS)
        ├── WakenetModelPacker.js  # Mirrors Python pack_model.py
        ├── WasmGifScaler.js       # gifsicle-wasm scaler
        ├── WebSocketTransfer.js   # Device flashing transport
        ├── ConfigStorage.js       # LocalStorage persistence
        ├── StorageHelper.js
        └── font_conv/             # TTF/WOFF → CBIN pipeline (FreeType WASM + opentype.js)
mcp_calls.log                  # Example MCP tool calls for device control
```

## Tech stack

- Vue 3.3 (Composition API, `<script setup>`), Vue Router 4, vue-i18n 9
- Vite 5 (dev on :3000, base `/tools/assets-generator/`)
- Tailwind CSS 3 + PostCSS
- opentype.js (font parsing), FreeType WASM (rasterization)
- gifsicle-wasm-browser (GIF scaling)
- jszip, axios, @vueuse/core, debug
- ES modules (`"type": "module"`)

## Generation pipeline

`AssetsBuilder.build()` runs in-browser:
1. Validate chip (ESP32-S3/C3/P4/C6) + display (RGB565, 240×135 – 320×240).
2. Convert font — preset or uploaded TTF/WOFF → `.cbin` via `BrowserFontConverter` (FreeType WASM, charset-filtered, 1/2/4 bpp).
3. Pack wake-word model — WakeNet9/9s preset, or MultiNet6/7 custom phrases → `srmodels.bin`.
4. Scale emoji pack (PNG/GIF) to target resolution, cached.
5. Render background colors / images → RGB565 bitmaps (light + dark).
6. Emit `index.json` manifest.
7. `SpiffsGenerator` packs everything into `assets.bin` (SPIFFS header + mmap table + data blocks).

MCP integration (`useDeviceStatus.js`): polls `self.get_device_status`, `self.upgrade_firmware`, `self.assets.set_download_url`, `self.screen.*`, `self.audio_speaker.*`. `WebSocketTransfer.js` streams the built asset to the device.

## Commands

```bash
cd web
npm install
npm run dev        # Vite dev server :3000
npm run build      # → dist/
npm run preview    # preview production build
```

`VITE_BASE_URL` env var overrides the default base path.

## Conventions

- JavaScript only (no TS).
- Vue 3 Composition API + `<script setup>`; PascalCase components, camelCase for vars/methods.
- Utilities are class-based (`AssetsBuilder`, `SpiffsGenerator`, `WakenetModelPacker`).
- Tailwind utility classes; custom primary palette in `tailwind.config.js`.
- No linter configured — match surrounding style.
- i18n keys live in `src/locales/*.json`; add to all five locales when introducing UI strings.

## Working on this repo

- **Adding a theme option** → extend the relevant tab component under `src/components/tabs/`, wire config into `AssetsBuilder`, update the manifest emitted in `index.json`, persist via `ConfigStorage`.
- **Supporting a new chip / display** → update `ChipConfig.vue` presets and any resolution-dependent logic in `WasmGifScaler` / background renderers.
- **Binary format changes** (SPIFFS layout, model pack) must stay in sync with the firmware's consumer (`xiaozhi-esp32/main/assets/` and wake-word loader). Coordinate breaking changes.
- **No backend** — don't add server-side dependencies. Everything must work offline after initial load.
- **MCP calls**: keep tool names aligned with firmware's `mcp_server.cc` registrations; see `mcp_calls.log` for current tool surface.

## Branch policy

- Develop on `claude/add-claude-documentation-D9b9t` (or branch specified in task).
- Never push to `main` directly; PRs only on explicit user request.

## Asset format cheat sheet

`assets.bin` is a SPIFFS image containing:
- `index.json` — manifest (version, chip, display, paths to srmodels, font, skin, emoji, multinet)
- `srmodels.bin` — packed wake-word models
- `font_*.bin` — CBIN font
- `emoji_*.png|.gif` — scaled frames
- `background_*.raw` — RGB565 bitmaps (light/dark)
