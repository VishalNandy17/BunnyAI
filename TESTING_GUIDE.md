# Testing Guide for BunnyAI Pro Extension

## Method 1: Development Mode Testing (Recommended)

### Step 1: Launch Extension in Development Mode
1. Open the project in VS Code
2. Press **F5** (or go to **Run and Debug** > **Run Extension**)
3. A new VS Code window will open (Extension Development Host)

### Step 2: Test CodeLens Feature
1. In the **new window**, open `sample-server.ts`
2. You should see **CodeLens** buttons above route definitions:
   - `▶ Run GET /api/users` above line 7
   - `▶ Run POST /api/users` above line 12
3. Click on any CodeLens button
4. The **BunnyAI Request Panel** should open

### Step 3: Test Request Panel
1. Verify the Request Panel opens with:
   - Method dropdown (GET/POST/PUT/DELETE)
   - URL input field (pre-filled with route)
   - Send Request button
2. Click **Send Request**
3. Check the response area for simulated response

### Step 4: Test Commands
1. Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
2. Type "BunnyAI" and test:
   - `BunnyAI: Run API`
   - `BunnyAI: Generate Tests`
   - `BunnyAI: Analyze Error`
   - `BunnyAI: Generate Documentation`

### Step 5: Check Sidebar
1. Look for **BunnyAI** icon in the Activity Bar (left sidebar)
2. Click it to see:
   - Requests view
   - History view
   - Collections view

### Step 6: Check Debug Console
1. In the **original VS Code window**, check the **Debug Console**
2. You should see logs like:
   - "Activating BunnyAI Pro..."
   - "BunnyAI Pro activated successfully!"
   - "Running API: GET /api/users"

## Method 2: Test Installed Extension

### Step 1: Install the VSIX
```bash
code --install-extension bunnyai-pro-0.0.1.vsix
```

### Step 2: Reload VS Code
1. Close and reopen VS Code, or
2. Press `Ctrl+Shift+P` and run "Developer: Reload Window"

### Step 3: Test Features
Follow the same testing steps as Method 1

## Method 3: Automated Tests

### Run Unit Tests
```bash
npm test
```

### Run with Coverage
```bash
npm run compile-tests
npm test
```

## Method 4: Manual Feature Testing Checklist

### ✅ CodeLens Provider
- [ ] Open TypeScript/JavaScript file with Express routes
- [ ] Verify CodeLens appears above route definitions
- [ ] Click CodeLens to open Request Panel

### ✅ Request Panel
- [ ] Panel opens correctly
- [ ] Method and URL are pre-filled
- [ ] Can change method
- [ ] Can edit URL
- [ ] Send Request button works
- [ ] Response displays correctly

### ✅ Commands
- [ ] All commands appear in Command Palette
- [ ] Commands execute without errors
- [ ] Commands show appropriate messages

### ✅ Sidebar Views
- [ ] BunnyAI icon appears in Activity Bar
- [ ] Requests view is accessible
- [ ] History view is accessible
- [ ] Collections view is accessible

### ✅ Error Handling
- [ ] Extension activates without errors
- [ ] No errors in Debug Console
- [ ] Error messages display correctly

### ✅ Logging
- [ ] Check Output Panel for "BunnyAI Pro" channel
- [ ] Verify logs appear for actions
- [ ] Error logs are captured

## Troubleshooting

### CodeLens Not Appearing
1. Make a small edit to the file to trigger re-parsing
2. Check Debug Console for errors
3. Verify file language is TypeScript or JavaScript
4. Ensure routes follow Express.js pattern

### Extension Not Activating
1. Check Debug Console for errors
2. Verify `dist/extension.js` exists
3. Run `npm run build` to rebuild
4. Check Output Panel for "BunnyAI Pro" channel

### Request Panel Not Opening
1. Check Debug Console for errors
2. Verify WebviewManager is initialized
3. Check browser console (if webview has DevTools)

## Testing Different Frameworks

### Express.js (sample-server.ts)
- Already included in project
- Should detect GET and POST routes

### Add More Test Files
Create test files for:
- NestJS routes
- FastAPI routes
- Flask routes
- Django routes

## Performance Testing

1. Open large TypeScript file with many routes
2. Check CodeLens rendering performance
3. Test with multiple files open
4. Monitor memory usage

## Integration Testing

1. Test with real API server running
2. Test with different HTTP methods
3. Test with different route patterns
4. Test error scenarios

