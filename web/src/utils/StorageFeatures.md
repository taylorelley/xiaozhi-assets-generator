# Configuration persistence features

## Overview

This project adds IndexedDB-backed persistence for configuration data and uploaded files, so that users can keep their previous configuration state and uploaded files even after refreshing the page.

## Key features

### 1. Automatic configuration saving
- **Real-time save**: configuration changes are automatically persisted to IndexedDB
- **Smart detection**: the app detects existing saved configuration on page load
- **State restoration**: progress position and theme tab state are restored

### 2. Automatic file storage
- **Font files**: custom font files are saved automatically, including the converted font data
- **Emoji images**: custom emoji images are saved automatically
- **Background images**: light/dark mode backgrounds are saved automatically

### 3. Restart feature
- **One-click cleanup**: a restart button wipes all stored data after confirmation
- **Safe confirmation**: a detailed confirmation dialog helps avoid accidental data loss
- **Full reset**: clears configuration, files, and temporary data

## Technical implementation

### Core components

#### ConfigStorage.js
- IndexedDB database management
- Configuration storage and restoration
- Binary file storage
- Temporary-data management

#### StorageHelper.js
- Convenient storage APIs for components
- Unified file-save and file-delete interfaces
- Categorised management of different resource types

#### AssetsBuilder.js integration
- Deep integration with the storage system
- Automatically saves converted font data
- Smart restoration of resource files

### Storage schema

```javascript
// Database: XiaozhiConfigDB
{
  configs: {      // Configuration table
    key: 'current_config',
    config: { ... },           // Full configuration object
    currentStep: 1,            // Current step
    activeThemeTab: 'font',    // Active tab
    timestamp: 1234567890      // Save timestamp
  },

  files: {        // Files table
    id: 'custom_font',
    type: 'font',              // File type
    name: 'MyFont.ttf',        // Filename
    size: 1024,                // File size
    mimeType: 'font/ttf',      // MIME type
    data: ArrayBuffer,         // File binary data
    metadata: { ... },         // Metadata
    timestamp: 1234567890      // Save timestamp
  },

  temp_data: {    // Temporary data table
    key: 'converted_font_xxx',
    type: 'converted_font',    // Data type
    data: ArrayBuffer,         // Converted data
    metadata: { ... },         // Metadata
    timestamp: 1234567890      // Save timestamp
  }
}
```

## User experience

### First-time use
1. User configures the chip, theme, etc. normally
2. Each change is automatically saved to local storage
3. Uploaded files are saved in sync

### After a page refresh
1. A "Saved configuration detected" notice appears
2. The previous configuration state is restored automatically
3. Uploaded files and converted data are restored
4. A "Restart" option is available

### Restart
1. Click the "Restart" button
2. A detailed confirmation dialog is shown
3. The dialog lists the data types that will be cleared
4. On confirmation, everything resets to the initial state

## API reference

### ConfigStorage main methods

```javascript
// Save configuration
await configStorage.saveConfig(config, currentStep, activeThemeTab)

// Load configuration
const data = await configStorage.loadConfig()

// Save a file
await configStorage.saveFile(id, file, type, metadata)

// Load a file
const file = await configStorage.loadFile(id)

// Clear all data
await configStorage.clearAll()
```

### StorageHelper convenience methods

```javascript
// Save font file
await StorageHelper.saveFontFile(file, config)

// Save emoji file
await StorageHelper.saveEmojiFile(emojiName, file, config)

// Save background file
await StorageHelper.saveBackgroundFile(mode, file, config)

// Delete files
await StorageHelper.deleteFontFile()
await StorageHelper.deleteEmojiFile(emojiName)
await StorageHelper.deleteBackgroundFile(mode)
```

## Caveats

### Browser compatibility
- Requires a modern browser that supports IndexedDB
- Recommended: Chrome 58+, Firefox 55+, Safari 10.1+

### Storage limits
- IndexedDB storage is subject to browser-imposed limits
- Large files may impact storage performance
- Regularly clean up data you no longer need

### Privacy considerations
- Data is only stored in the user's local browser
- Nothing is uploaded to the server
- Clearing browser data erases the stored configuration

## Troubleshooting

### Storage failures
- Verify that the browser supports IndexedDB
- Ensure there is enough browser storage space
- Check whether private browsing mode is enabled

### Lost configuration
- Clearing browser data will remove saved configuration
- Browser upgrades may affect storage compatibility
- Back up important configurations manually

### Performance issues
- Storing many files may degrade performance
- Use the "Restart" feature periodically to clean up data
- Avoid frequent uploads of very large files
