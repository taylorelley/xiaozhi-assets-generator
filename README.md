# LittleWise AI Custom Assets — Single-Page App

([English](README.md) | [中文](README_zh.md))

## Purpose

A browser-based tool that lets owners of LittleWise (XiaoZhi-compatible) AI voice-chat devices build a custom theme — wake-word model, emoji pack, text font, and chat background — and export it as a single `assets.bin` file that can be flashed onto the device.

## Feature Overview

Building an `assets.bin` is a 3-step wizard:

- **Step 1**: Choose chip model, display type, and resolution.
- **Step 2**: Theme design (a tabbed interface for configuring each category).
- **Step 3**: Review the asset manifest and click Generate.

## Page-by-Page Functionality

### Choose chip model, display type, and resolution

The app provides quick presets for common boards, for example:

- LCSC·Real-World ESP32-S3 → `esp32s3`, LCD 320×240, RGB565
- ESP-BOX-3 → `esp32s3`, LCD 320×240, RGB565
- Unnamed Tech·XingZhi 1.54 TFT → `esp32s3`, LCD 240×240, RGB565
- Surfer C3 1.14 TFT → `esp32c3`, LCD 240×135, RGB565

You can also define a custom chip (choose between `esp32s3`, `esp32c3`, `esp32p4`, `esp32c6`) with a custom resolution. Colour depth is currently limited to 16-bit RGB565.

### Theme Design

#### Tab 1: Wake-word configuration

Two wake-word modes are supported: **Preset wake words** and **Custom wake words**.

##### 1. Preset wake words (WakeNet)

C3/C6 chips only support WakeNet9s models; S3/P4 chips only support WakeNet9 models.

Common presets:

| Wake word         | WakeNet9s (C3/C6)      | WakeNet9 (S3/P4)          |
| :---------------- | :--------------------: | :-----------------------: |
| Hi, Espressif     | wn9s_hilexin           | wn9_hilexin               |
| Hi, ESP           | wn9s_hiesp             | wn9_hiesp                 |
| Hello LittleWise  | wn9s_nihaoxiaozhi      | wn9_nihaoxiaozhi_tts      |
| Hi, Jason         | wn9s_hijason_tts2      | wn9_hijason_tts2          |
| Xiaoai Classmate  | -                      | wn9_xiaoaitongxue         |
| Hey Xiao-Ou       | -                      | wn9_hai1xiao3ou1_tts3     |
| Hello Xiaorui     | -                      | wn9_ni3hao3xiao3rui4_tts3 |

The wake-word flow mirrors `spiffs_assets/pack_model.py`: it packs the matching model directory under `share/wakenet_model` into an `srmodels.bin`.

##### 2. Custom wake words (MultiNet)

Only **ESP32-S3** currently supports custom wake words. Users can enter a custom command phrase in Chinese or English:

- **Chinese**: uses `mn6_cn` or `mn7_cn`, supports pinyin input (e.g. `ni hao xiao zhi`).
- **English**: uses `mn6_en` or `mn7_en`, supports plain English phrases.
- **Parameters**: adjustable threshold (0–100) and duration (timeout, in ms).

The app generates the MultiNet configuration from the user's phrase and includes it in `assets.bin`.

#### Tab 2: Font configuration

Users can pick a preset font (shipped under `share/fonts`) and skip the font-build step entirely. Common presets:

- `font_puhui_14_1` — Alibaba Puhui, 7000 common glyphs, size 14 px, bpp 1
- `font_puhui_16_4` — Alibaba Puhui, 7000 common glyphs, size 16 px, bpp 4
- `font_puhui_20_4` — Alibaba Puhui, 7000 common glyphs, size 20 px, bpp 4
- `font_puhui_30_4` — Alibaba Puhui, 7000 common glyphs, size 30 px, bpp 4

Users can also upload custom fonts:

- Select a local font file; TTF and WOFF are supported.
- Choose size (8–80, commonly 14, 16, 20, or 30) and bpp (1, 2, or 4).
- Choose charset (GB2312 with 7445 glyphs, or DeepSeek R1 with 7405 glyphs). Default: DeepSeek R1.

Custom fonts are converted to `cbin` via `lv_font_conv/lib/convert.js`; the output is named `font_[name]_[size]_[bpp].bin`.

### Tab 3: Emoji collection

A full emoji pack contains 21 images: one `neutral` default plus 20 expressions. Emoji-to-slot mapping:

| 😶 | neutral      |
| 🙂 | happy        |
| 😆 | laughing     |
| 😂 | funny        |
| 😔 | sad          |
| 😠 | angry        |
| 😭 | crying       |
| 😍 | loving       |
| 😳 | embarrassed  |
| 😯 | surprised    |
| 😱 | shocked      |
| 🤔 | thinking     |
| 😉 | winking      |
| 😎 | cool         |
| 😌 | relaxed      |
| 🤤 | delicious    |
| 😘 | kissy        |
| 😏 | confident    |
| 😴 | sleepy       |
| 😜 | silly        |
| 🙄 | confused     |

Built-in preset emoji packs:

- Twemoji 32×32 PNG (`share/twemoji32`)
- Twemoji 64×64 PNG (`share/twemoji64`)

Users can also upload a custom pack:

- Pick a single `width × height` for all images; must not exceed the screen resolution.
- Choose animated (GIF) or static transparent (PNG) format.
- A `neutral` default image is required (it is auto-scaled to `width × height`).
- All other emotions are optional — any emotion without a custom image falls back to `neutral`.

### Tab 4: Chat background

The background has two variants — light mode and dark mode — with colour as the default:

- Default light: `#ffffff`; default dark: `#121212`.

Users can change the colours or upload a static image as the background. The two modes can have different images or share the same one. Background images are auto-scaled to the device's resolution; the packed format is usually an RGB565 bitmap with a 64-byte `lv_image_dsc_t` header.

### Generate `assets.bin`

At any point during theme design, users can click the Generate button in the top-right to open a modal that lists every asset about to be packed. After confirming, generation starts. Custom font conversion is the slowest step; results are cached so re-generating with the same font is fast.

Everything runs in the browser — no backend API is required.

## Implementation Notes

### Browser-side generation of `assets.bin`

The project uses a fully in-browser generation pipeline:

1. **`WakenetModelPacker.js`** — replicates `pack_model.py`, packing wake-word models into `srmodels.bin`.
2. **`SpiffsGenerator.js`** — replicates `spiffs_assets_gen.py`, producing the final `assets.bin`.
3. **`AssetsBuilder.js`** — orchestrates the other modules; mirrors the flow of `build.py`.

### Generation pipeline

1. Load the user's configuration.
2. Process the font file (preset, or convert a custom font).
3. Process the wake-word model:
   - **Preset mode**: load the matching model from `public/static/wakenet_model/` and pack it.
   - **Custom mode**: load a MultiNet model from `public/static/multinet_model/` and build a config from the user's phrase.
4. Process emoji images (preset or custom).
5. Process background images and convert to RGB565.
6. Generate the `index.json` manifest.
7. Pack everything into `assets.bin` using the SPIFFS format.

### Asset layout

The generated `assets.bin` includes an `index.json` that looks roughly like this:

Example 1:
```json
{
    "version": 1,
    "chip_model": "esp32s3",
    "display_config": {
        "width": 320,
        "height": 240,
        "monochrome": false,
        "color": "RGB565"
    },
    "srmodels": "srmodels.bin",
    "text_font": "font_puhui_common_30_4.bin",
    "skin": {
        "light": {
            "text_color": "#000000",
            "background_color": "#FFFFFF",
            "background_image": "background_light.raw"
        },
        "dark": {
            "text_color": "#FFFFFF",
            "background_color": "#121212",
            "background_image": "background_dark.raw"
        }
    },
    "emoji_collection": [
        {
            "name": "sleepy",
            "file": "sleepy.png"
        },
        ...
    ],
    "multinet": {
        "model": "mn6_en",
        "command": "hi little wise",
        "threshold": 20,
        "duration": 3000
    }
}
```

Example 2:
```json
{
    "version": 1,
    "chip_model": "esp32c3",
    "display_config": {
        "width": 240,
        "height": 240,
        "monochrome": false,
        "color": "RGB565"
    },
    "srmodels": "srmodels.bin",
    "text_font": "font_puhui_common_16_4.bin",
    "skin": {
        "light": {
            "text_color": "#000000",
            "background_color": "#FFFFFF"
        },
        "dark": {
            "text_color": "#FFFFFF",
            "background_color": "#121212"
        }
    },
    "emoji_collection": [
        {
            "name": "sleepy",
            "file": "sleepy.png"
        },
        ...
    ]
}
```
