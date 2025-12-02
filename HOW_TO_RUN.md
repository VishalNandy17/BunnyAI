# How to Run BunnyAI Pro

## Quick Start

### 1. Build the Project
```bash
npm run build
```

### 2. Launch the Extension
1. Press **F5** (or go to **Run and Debug** > **Run Extension**).
2. A new VS Code window (Extension Development Host) will open.

### 3. Configure AI API Key (Optional)
If you want to use AI features (test generation, documentation, error analysis):

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Run **"BunnyAI: Configure AI API Key"**
3. Enter your OpenAI, Anthropic, or custom API key
4. The key will be stored securely in VS Code's SecretStorage

**Note**: The extension will automatically migrate any existing API keys from settings to SecretStorage for better security.

### 4. Test the Features
In the **new** window that opened:
1. Open the `sample-server.ts` file (if available in your workspace).
2. You should see **"Run GET /api/users"** (CodeLens) appear above the code.
3. Click that button!
4. The **BunnyAI Request Panel** will open with the method and URL filled in.
5. Click **Send Request** to execute the API request.

## Configuration

### VS Code Settings
Open Settings (`Ctrl+,`) and search for "BunnyAI" to configure:

- **Base URL**: Default base URL for API requests
- **Default Timeout**: Request timeout in milliseconds (default: 30000)
- **Enable Cache**: Enable/disable response caching
- **Cache TTL**: Cache time-to-live in milliseconds (default: 300000)
- **Max Retries**: Maximum retry attempts (default: 3)
- **Retry Delay**: Initial retry delay in milliseconds (default: 1000)
- **AI Provider**: Choose between OpenAI, Anthropic, or Custom
- **AI Model**: Model name (e.g., gpt-4, gpt-3.5-turbo, claude-3)
- **Max Request Body Size**: Maximum request body size in bytes (default: 1MB)
- **Max Response Size**: Maximum response size in bytes (default: 10MB)
- **Auto Detect Framework**: Automatically detect framework from project files
- **Enable CodeLens**: Enable/disable CodeLens for route detection

## Security Features

### Secret Storage
- AI API keys are stored securely using VS Code's SecretStorage API
- Keys are encrypted and stored separately from workspace settings
- Use the **"BunnyAI: Configure AI API Key"** command to manage keys

### URL Validation
- Only `http://` and `https://` protocols are allowed
- Invalid protocols are rejected with clear error messages

### Size Limits
- Request body size is limited (default: 1MB, configurable)
- Response size is limited (default: 10MB, configurable)
- Prevents memory issues with large payloads

## Troubleshooting

- **CodeLens not appearing**: Make a small edit to the file to trigger re-parsing
- **Extension not activating**: Check the Debug Console in the main window for errors
- **AI features not working**: Ensure you've configured the API key using the command
- **Request fails**: Check the URL, network connectivity, and server status

## Next Steps

- See [TESTING_GUIDE.md](TESTING_GUIDE.md) for comprehensive testing instructions
- See [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) for feature details
