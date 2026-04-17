# Font Converter - Browser-side Font Converter

This is a browser-side font converter based on the core logic of `lv_font_conv`. It converts TTF/WOFF font files into the LVGL-compatible CBIN format.

## Module structure

```
font_conv/
├── AppError.js              # Error handling class
├── Ranger.js                # Character-range manager
├── Utils.js                 # Utility functions
├── FreeType.js              # FreeType interface (ES6 version)
├── CollectFontData.js       # Core module for collecting font data
├── BrowserFontConverter.js  # Main converter interface
├── TestConverter.js         # Test module
├── freetype_build/          # WebAssembly FreeType module
└── writers/
    ├── CBinWriter.js        # CBIN format writer
    └── CBinFont.js          # CBIN font class
```

## Usage

### Basic usage

```javascript
import browserFontConverter from './font_conv/BrowserFontConverter.js'

// Initialize the converter
await browserFontConverter.initialize()

// Convert a font
const result = await browserFontConverter.convertToCBIN({
  fontFile: fontFile,          // File object
  fontName: 'my_font',
  fontSize: 20,
  bpp: 4,
  charset: 'deepseek',
  progressCallback: (progress, message) => {
    console.log(`${progress}% - ${message}`)
  }
})

// result is an ArrayBuffer containing the CBIN-format font data
```

### Get font information

```javascript
const fontInfo = await browserFontConverter.getFontInfo(fontFile)
console.log('Font info:', fontInfo)
/*
{
  familyName: "Arial",
  fullName: "Arial Regular",
  postScriptName: "ArialMT",
  version: "1.0",
  unitsPerEm: 2048,
  ascender: 1854,
  descender: -434,
  numGlyphs: 3200,
  supported: true
}
*/
```

### Size estimation

```javascript
const estimate = browserFontConverter.estimateSize({
  fontSize: 20,
  bpp: 4,
  charset: 'deepseek'
})

console.log('Estimate:', estimate)
/*
{
  characterCount: 7405,
  avgBytesPerChar: 65,
  estimatedSize: 481325,
  formattedSize: "470 KB"
}
*/
```

## Configuration options

### Conversion parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `fontFile` | File/ArrayBuffer | - | Font file |
| `fontName` | string | 'font' | Output font name |
| `fontSize` | number | 20 | Font size (8-80) |
| `bpp` | number | 4 | Bit depth (1, 2, 4, 8) |
| `charset` | string | 'basic' | Preset character set |
| `symbols` | string | '' | Custom characters |
| `range` | string | '' | Unicode range |
| `compression` | boolean | true | Enable compression |
| `lcd` | boolean | false | Horizontal sub-pixel rendering |
| `lcd_v` | boolean | false | Vertical sub-pixel rendering |

### Supported character sets

- `basic`: Basic ASCII character set (95 characters)
- `deepseek`: DeepSeek R1 common Chinese characters (7405 characters)
- `gb2312`: GB2312 Chinese character set (7445 characters)

### Supported font formats

- TTF (TrueType Font)
- WOFF (Web Open Font Format)
- WOFF2 (Web Open Font Format 2.0)
- OTF (OpenType Font)

## Technical implementation

### Core dependencies

1. **opentype.js**: Parses the font file structure
2. **WebAssembly FreeType**: Renders glyphs and generates glyph data
3. **Custom CBIN writer**: Generates the LVGL-compatible format

### Conversion flow

1. **Font parsing**: Use opentype.js to parse the font file
2. **Glyph rendering**: Render glyphs through the FreeType WebAssembly module
3. **Data collection**: Gather glyph data, metrics, and kerning info
4. **Format conversion**: Convert the data into the CBIN format
5. **Output**: Emit the final binary file

### Differences from the original

| Feature | Original `lv_font_conv` | Browser version |
|---------|-------------------------|-----------------|
| Runtime | Node.js | Browser |
| Module system | CommonJS | ES6 modules |
| File system | `fs` module | File API |
| Buffers | `Buffer` | `ArrayBuffer` / `Uint8Array` |
| Command line | CLI | JavaScript API |

## Tests

```javascript
import { testFontConverter, testWithSampleFont } from './font_conv/TestConverter.js'

// Basic feature test
await testFontConverter()

// Font file test
const result = await testWithSampleFont(fontFile)
console.log('Test result:', result)
```

## Caveats

1. **WebAssembly support**: Browsers must support WebAssembly
2. **Memory limits**: Large font files can consume significant memory
3. **Processing time**: Complex fonts and large character sets take longer to convert
4. **File size**: `ft_render.wasm` is relatively large (~2MB)
5. **Compatibility**: Requires a modern browser

## Performance benchmarks

| Charset size | Font size | BPP | Estimated time | Output size |
|--------------|-----------|-----|----------------|-------------|
| 100 chars | 16px | 4 | < 1s | ~10KB |
| 1000 chars | 20px | 4 | 2-5s | ~100KB |
| 7000 chars | 20px | 4 | 10-30s | ~500KB |

## Known issues

1. **Font validation**: Some corrupted font files may cause crashes
2. **Memory management**: Long-running use may leak memory
3. **Error handling**: WebAssembly errors are hard to debug
4. **Charset**: Certain special characters may not render correctly

## Future improvements

- [ ] Support more font formats
- [ ] Optimize memory usage
- [ ] Add a font preview feature
- [ ] Support font subsetting
- [ ] Add more compression options
- [ ] Support color fonts

---

*Adapted from the lv_font_conv project for the browser environment*
