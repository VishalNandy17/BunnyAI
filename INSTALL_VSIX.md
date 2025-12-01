# Installing BunnyAI Pro VSIX Package

## ✅ VSIX Package Created Successfully

The VSIX package has been created at:
```
D:\BunnyAI\bunnyai-pro-0.0.1.vsix
```

**Package Details:**
- **Size**: 5.05 MB
- **Version**: 0.0.1
- **Icon**: ✅ Included (icon.png - 875 KB)
- **Files**: 42 files included

## Installation Methods

### Method 1: Install via Command Prompt (Recommended)

#### Step 1: Open Command Prompt or PowerShell
- Press `Win + R`
- Type `cmd` or `powershell` and press Enter
- Or open VS Code's integrated terminal (Ctrl + `)

#### Step 2: Navigate to the VSIX location (if needed)
```cmd
cd D:\BunnyAI
```

#### Step 3: Install the VSIX using VS Code CLI
```cmd
code --install-extension bunnyai-pro-0.0.1.vsix
```

**Alternative using full path:**
```cmd
code --install-extension "D:\BunnyAI\bunnyai-pro-0.0.1.vsix"
```

#### Step 4: Verify Installation
```cmd
code --list-extensions | findstr bunnyai
```

You should see:
```
bunnyai.bunnyai-pro
```

### Method 2: Install via VS Code UI

1. Open VS Code
2. Go to **Extensions** view (Ctrl + Shift + X)
3. Click the **...** (three dots) menu at the top
4. Select **Install from VSIX...**
5. Navigate to `D:\BunnyAI\bunnyai-pro-0.0.1.vsix`
6. Click **Install**

### Method 3: Double-click Installation (Windows)

1. Navigate to `D:\BunnyAI\` in File Explorer
2. Double-click `bunnyai-pro-0.0.1.vsix`
3. VS Code will prompt to install the extension

## Post-Installation Steps

### 1. Reload VS Code
After installation, VS Code will prompt you to reload. Click **Reload** or:
- Press `Ctrl + Shift + P`
- Type "Reload Window"
- Press Enter

### 2. Verify Extension is Active
- Check the Activity Bar for the BunnyAI icon
- Press `Ctrl + Shift + P` and type "BunnyAI" to see available commands
- Check the status bar (bottom right) for "BunnyAI" indicator

### 3. Configure Settings (Optional)
1. Press `Ctrl + ,` to open Settings
2. Search for "BunnyAI"
3. Configure:
   - Base URL for your API
   - AI Provider settings (if using AI features)
   - Cache settings
   - Timeout settings

## Uninstalling the Extension

### Via Command Prompt:
```cmd
code --uninstall-extension bunnyai.bunnyai-pro
```

### Via VS Code UI:
1. Go to Extensions (Ctrl + Shift + X)
2. Search for "BunnyAI Pro"
3. Click the gear icon
4. Select "Uninstall"

## Troubleshooting

### Issue: "code" command not found
**Solution**: Add VS Code to PATH
1. Open VS Code
2. Press `Ctrl + Shift + P`
3. Type "Shell Command: Install 'code' command in PATH"
4. Press Enter
5. Restart your terminal

### Issue: Extension doesn't appear after installation
**Solution**: 
1. Reload VS Code window
2. Check if extension is listed: `code --list-extensions`
3. Check VS Code Output panel for errors

### Issue: Icon not showing
**Solution**: 
- The icon is included in the VSIX (icon.png)
- It should appear in the Extensions marketplace view
- If not visible, try reinstalling

## Quick Test

After installation, test the extension:

1. **Open a TypeScript/JavaScript file** with Express routes
2. **Look for CodeLens** - You should see "▶ Run GET /api/..." above routes
3. **Click a CodeLens** - Request panel should open
4. **Check Sidebar** - BunnyAI icon should be in Activity Bar
5. **Run Command** - Press `Ctrl + Shift + P`, type "BunnyAI: Run API"

## Package Contents

The VSIX includes:
- ✅ Extension code (dist/extension.js)
- ✅ Icon (icon.png - 875 KB)
- ✅ Media files (icons, styles, scripts)
- ✅ Resources (snippets, templates)
- ✅ Test files
- ✅ Documentation (README, guides)
- ✅ Source maps for debugging

## Next Steps

1. **Configure AI Provider** (if using AI features):
   - Set `bunnyai.aiApiKey` in settings
   - Choose provider: `openai`, `anthropic`, or `custom`

2. **Set Base URL**:
   - Configure `bunnyai.baseUrl` for your API server

3. **Start Using**:
   - Open your Express/API project
   - Use CodeLens to run API requests
   - Check History for past requests
   - Create Collections for organized testing

---

**Package Location**: `D:\BunnyAI\bunnyai-pro-0.0.1.vsix`
**Installation Command**: `code --install-extension "D:\BunnyAI\bunnyai-pro-0.0.1.vsix"`

