# Testing Guide for BunnyAI Pro Extension

## Quick Testing

### Method 1: Development Mode (Recommended)

1. **Press F5** in VS Code
   - Opens a new Extension Development Host window

2. **In the new window**:
   - Open `sample-server.ts` (or any Express.js file)
   - Look for CodeLens buttons above routes (e.g., `▶ Run GET /api/users`)
   - Click a CodeLens button
   - The BunnyAI Request Panel should open

3. **Test the Request Panel**:
   - Verify method and URL are pre-filled
   - Click "Send Request"
   - Check the response

4. **Test commands**:
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
   - Type "BunnyAI" and try:
     - `BunnyAI: Run API`
     - `BunnyAI: Generate Tests` (requires AI API key)
     - `BunnyAI: Analyze Error` (requires AI API key)
     - `BunnyAI: Generate Documentation` (requires AI API key)
     - `BunnyAI: Configure AI API Key` (new!)

5. **Check the sidebar**:
   - Look for the BunnyAI icon in the Activity Bar
   - Click to see Requests, History, and Collections views

6. **Check logs**:
   - In the original VS Code window, open the Debug Console
   - You should see activation logs

### Method 2: Test Installed Extension

```bash
# Install the VSIX
code --install-extension bunnyai-pro-0.0.1.vsix

# Then reload VS Code and test the same features
```

### Method 3: Automated Tests

```bash
# Run all tests
npm test

# This runs:
# - HTTP Client tests
# - API Executor tests
# - Middleware tests (Auth, Retry, Cache)
# - Config Manager tests
# - Express Parser tests
# - Extension tests
```

## Security Testing

### Test Secret Storage
1. Run `BunnyAI: Configure AI API Key`
2. Enter a test API key
3. Verify the key is stored securely (not visible in settings.json)
4. Test AI features to confirm key works

### Test URL Validation
1. Try to send a request with `file://` protocol
2. Should be rejected with clear error message
3. Try `http://` and `https://` - should work

### Test Size Limits
1. Try sending a request body larger than configured limit
2. Should be rejected with clear error message
3. Test with responses larger than configured limit
4. Should handle gracefully

## Feature Testing Checklist

### ✅ Core Features
- [ ] Extension activates without errors
- [ ] CodeLens appears above routes
- [ ] Request Panel opens correctly
- [ ] HTTP requests execute successfully
- [ ] Responses display correctly
- [ ] History is saved and displayed
- [ ] Collections can be created and managed

### ✅ AI Features (Requires API Key)
- [ ] Test generation works
- [ ] Documentation generation works
- [ ] Error analysis works
- [ ] API key is stored securely
- [ ] Rate limiting prevents spam

### ✅ Security Features
- [ ] Secret Storage works correctly
- [ ] URL validation rejects invalid protocols
- [ ] Size limits are enforced
- [ ] Error messages are user-friendly

### ✅ Performance
- [ ] CodeLens renders quickly
- [ ] Parser caching works
- [ ] Debouncing prevents excessive parsing
- [ ] Large responses handled gracefully

### ✅ Error Handling
- [ ] Network errors handled gracefully
- [ ] Invalid URLs handled gracefully
- [ ] Missing API keys show helpful messages
- [ ] Extension doesn't crash on errors

## Testing Different Frameworks

### Express.js
- Basic routes: `app.get('/users', handler)`
- Route parameters: `app.get('/users/:id', handler)`
- Template strings: `app.get(\`/users/\${id}\`, handler)`
- Middleware arrays: `app.get('/users', [auth, handler])`
- Router instances: `router.get('/posts', handler)` with `app.use('/api', router)`

### NestJS (Basic Support)
- Controller decorators
- Route decorators

### FastAPI (Basic Support)
- Route decorators
- Path parameters

## Performance Testing

1. Open large TypeScript file with many routes (100+)
2. Check CodeLens rendering performance
3. Test with multiple files open simultaneously
4. Monitor memory usage in VS Code
5. Test cache effectiveness

## Integration Testing

1. **Test with real API server**:
   - Start a local Express server
   - Use CodeLens to run requests
   - Verify responses match expectations

2. **Test different HTTP methods**:
   - GET, POST, PUT, PATCH, DELETE
   - Verify method-specific behavior

3. **Test error scenarios**:
   - Network failures
   - Server errors (500)
   - Client errors (400, 404)
   - Timeouts

4. **Test middleware chain**:
   - Auth middleware
   - Retry middleware
   - Cache middleware

## Troubleshooting

### CodeLens Not Appearing
1. Make a small edit to trigger re-parsing
2. Check Debug Console for errors
3. Verify file language is TypeScript/JavaScript
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

### AI Features Not Working
1. Verify API key is configured using `BunnyAI: Configure AI API Key`
2. Check API key is valid
3. Check network connectivity
4. Review error messages in Debug Console

## Test Coverage

Current test coverage includes:
- ✅ HTTP Client (URL validation, size limits, timeouts)
- ✅ API Executor (request execution, error handling)
- ✅ Middleware (Auth, Retry, Cache)
- ✅ Config Manager (all configuration options)
- ✅ Express Parser (various route patterns)
- ✅ Extension activation

See `test/suite/` for all test files.
