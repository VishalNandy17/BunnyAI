# 🐰 BunnyAI Pro — Production-Ready VS Code Extension

[![Version](https://img.shields.io/visual-studio-marketplace/v/VishalNandy17.bunnyai-pro?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=VishalNandy17.bunnyai-pro)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/VishalNandy17.bunnyai-pro?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=VishalNandy17.bunnyai-pro)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/VishalNandy17.bunnyai-pro?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=VishalNandy17.bunnyai-pro)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/VishalNandy17.bunnyai-pro?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=VishalNandy17.bunnyai-pro)
[![License](https://img.shields.io/github/license/VishalNandy17/BunnyAI?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)

**BunnyAI Pro** is a comprehensive, enterprise-grade VS Code extension designed to supercharge your development workflow. Built with a robust TypeScript architecture, it combines advanced AI capabilities with powerful API testing tools and project-wide code intelligence (complexity analysis, security scanning, architecture insights), supporting a wide array of modern web frameworks.

[![Install from VS Code Marketplace](https://img.shields.io/badge/VS%20Code-Marketplace-blue?style=for-the-badge&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=VishalNandy17.bunnyai-pro)

## ✨ Features

### 🚀 Built-in API Client
A full-featured HTTP client integrated directly into VS Code:

- **Complete HTTP Methods**: Support for GET, POST, PUT, DELETE, PATCH, HEAD, and OPTIONS
- **Interactive Request Panel**: Beautiful webview interface for crafting and sending API requests
- **Request Body Editor**: JSON editor with syntax highlighting for request bodies
- **Custom Headers**: Add and manage custom HTTP headers per request
- **Response Display**: Formatted response viewer with status badges, duration, and size metrics
- **Real-time Execution**: Send requests and view responses instantly without leaving VS Code
- **Request/Response Size Tracking**: Monitor request body and response sizes
- **Timeout Handling**: Configurable request timeouts (default 30s) with clear error messages
- **URL Validation**: Security-first validation allowing only `http://` and `https://` protocols
- **Size Limits**: Configurable request body (default 1MB) and response (default 10MB) size limits

### 🤖 AI-Powered Development Tools
Leverage advanced AI to automate tedious development tasks:

- **Smart Test Generation**: Automatically generate comprehensive unit and integration tests for your code
  - Supports multiple testing frameworks
  - Includes edge cases and error handling
  - Generates mock data where appropriate
  - Context-aware test generation

- **Auto-Documentation**: Generate comprehensive code documentation instantly
  - Function/method descriptions
  - Parameter and return value documentation
  - Usage examples
  - Language-appropriate formats (JSDoc, docstrings, etc.)

- **Intelligent Error Analysis**: Get actionable insights for runtime errors
  - Clear explanations of error meanings
  - Common causes identification
  - Step-by-step solutions
  - Prevention tips

- **AI Code Review & Refactoring**: Get AI-powered code reviews and refactoring suggestions
  - Select code and get instant review feedback
  - Refactored code suggestions with explanations
  - Identifies complexity issues and code smells
  - Command: `BunnyAI: Review & Refactor Selection`

- **Multi-Provider Support**: 
  - **OpenAI** (GPT-4, GPT-3.5-turbo, etc.)
  - **Anthropic** (Claude 3 Opus, Sonnet, etc.)
  - **Custom AI Providers** (configurable endpoints)

- **Secure API Key Management**: 
  - Encrypted storage using VS Code SecretStorage
  - Automatic migration from settings
  - Rate limiting (500ms minimum between calls)
  - Easy configuration via command palette

### 🧠 Code Intelligence & Security
Comprehensive code analysis and security scanning capabilities:

- **Code Quality Analyzer**: Analyze code complexity and maintainability
  - Cyclomatic complexity metrics for functions
  - Maintainability grades (A-F) based on complexity and nesting
  - Visual diagnostics highlighting complex code
  - File-level quality reports with function breakdowns
  - Command: `BunnyAI: Analyze Code Quality`
  - **Example**: Select a function and instantly see its complexity score and maintainability grade

- **Multi-Language Comment Remover**: Safely remove comments while preserving code
  - Supports JavaScript/TypeScript, Python, Java, C/C++, C#, PHP, Go, Rust, HTML/CSS, Shell
  - Preserves comment-like text inside strings and template literals
  - Works on selections or entire files
  - Undo-friendly single operation
  - Command: `BunnyAI: Remove Comments from Selection`
  - **Example**: Clean up code before minification or remove outdated comments without breaking strings

- **Security Scanner**: Static analysis for common security vulnerabilities
  - Detects hardcoded secrets (API keys, tokens, passwords)
  - Identifies dangerous code patterns (eval, Function constructor, exec)
  - Flags SQL injection risks (string concatenation, template literals)
  - Warns about insecure HTTP usage
  - Highlights weak cryptography (MD5, SHA-1)
  - XSS risk detection (innerHTML, dangerouslySetInnerHTML)
  - VS Code diagnostics integration
  - Command: `BunnyAI: Security Scan File`
  - **Example**: Scan a file before committing to catch hardcoded API keys or SQL injection risks

- **AI Security Explanations**: Get detailed AI-powered explanations for security issues
  - Severity justification and risk assessment
  - Exploitation scenarios explained
  - Suggested fixes with code examples
  - Works with security scan results
  - Command: `BunnyAI: Explain Security Issues (with AI)`
  - **Example**: After scanning, get AI explanations for why a detected issue is critical and how to fix it

- **Workspace Code Health Dashboard**: Project-wide code health analysis
  - Recursively scans entire workspace (respects .gitignore)
  - Aggregates complexity metrics across all files
  - Identifies top 10 most complex functions
  - Security issues grouped by severity
  - Worst offender files highlighted
  - Interactive webview panel with clickable file navigation
  - Progress tracking and cancellable scans
  - Sidebar view showing last scan summary
  - Command: `BunnyAI: Analyze Workspace Code Health`
  - **Example**: Run a full workspace scan to identify the most complex files and security hotspots before a code review

### 🔍 Route Detection & CodeLens Integration
Intelligent route detection with inline execution:

- **CodeLens Buttons**: Click-to-run buttons appear above route definitions
- **Automatic Route Parsing**: Detects routes from your code files
- **Multi-Framework Support**: 
  - **Node.js**: Express.js, NestJS, GraphQL
  - **Python**: FastAPI, Django, Flask
  - **Java**: Spring Boot
  - **PHP**: Laravel
  - **Go**: Gin

- **Advanced Express Parsing**:
  - Route parameters (`:id`, `:userId`)
  - Template strings with variables
  - Router instances (`express.Router()`)
  - Router mounting (`app.use('/api', router)`)
  - Nested route path resolution
  - Middleware array support
  - All HTTP methods (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS, ALL)

- **Performance Optimized**: 
  - Route parsing cache (5 second TTL)
  - Debouncing for CodeLens (300ms)
  - Content hash-based cache invalidation

### 📊 Request History & Collections
Never lose track of your API interactions:

- **Request History**: 
  - Persistent storage of all API requests and responses
  - View method, URL, status, duration, and timestamp
  - History size limiting (100 entries)
  - Clear history functionality
  - Tree view in sidebar

- **API Collections**: 
  - Organize requests into collections
  - Group related API calls
  - Export collections to JSON
  - Import collections from JSON
  - Export/import all collections
  - Persistent storage

### 🛠️ Middleware & Advanced Features
Production-ready request processing pipeline:

- **Authentication Middleware**: 
  - Automatic API key injection from environment
  - Custom headers from environment variables
  - Base URL replacement for localhost requests

- **Retry Middleware**: 
  - Configurable retry attempts (default 3)
  - Exponential backoff strategy
  - Configurable retry delay (default 1000ms)
  - Automatic retry on network failures

- **Cache Middleware**: 
  - Response caching (configurable)
  - Cache TTL (default 5 minutes)
  - Cache size management
  - Cache invalidation

- **Environment Management**: 
  - Multiple environment support (Development, Production, etc.)
  - Environment-specific variables
  - Environment-specific API keys
  - Environment-specific base URLs
  - Easy environment switching

### 🎯 Workspace Detection
Automatic framework and project detection:

- **Auto-Detection**: Automatically detects your project framework
- **Confidence Scoring**: Provides confidence levels for detection
- **Config File Detection**: Identifies frameworks from configuration files
- **File-Based Detection**: Analyzes project structure
- **Status Bar Integration**: Shows detected framework in status bar

### 📱 VS Code Integration
Seamless integration with VS Code:

- **Sidebar Views**: 
  - **Requests View**: Browse detected API routes
  - **History View**: View request/response history
  - **Collections View**: Manage API collections
  - **Code Health View**: View last workspace scan summary and run new scans

- **Status Bar**: 
  - Framework detection indicator
  - Quick status information
  - Click to view details

- **Command Palette**: 
  - `BunnyAI: Run API` - Open request panel
  - `BunnyAI: Generate Tests` - Generate tests for selected code
  - `BunnyAI: Analyze Error` - Analyze selected error
  - `BunnyAI: Generate Documentation` - Generate docs for selected code
  - `BunnyAI: Configure AI API Key` - Securely configure AI API key
  - `BunnyAI: Analyze Code Quality` - Analyze code quality metrics
  - `BunnyAI: Review & Refactor Selection` - AI-powered code review and refactoring
  - `BunnyAI: Remove Comments from Selection` - Remove comments safely
  - `BunnyAI: Security Scan File` - Scan file for security vulnerabilities
  - `BunnyAI: Explain Security Issues (with AI)` - Get AI explanations for security issues
  - `BunnyAI: Analyze Workspace Code Health` - Analyze entire workspace code health

- **Progress Notifications**: Visual feedback for long-running operations
- **Error Notifications**: User-friendly error messages

### 🔒 Security Features
Enterprise-grade security built-in:

- **Secret Storage**: AI API keys stored using VS Code's encrypted SecretStorage
- **URL Validation**: Only `http://` and `https://` protocols allowed (prevents SSRF attacks)
- **Size Limits**: Prevents memory exhaustion and DoS attacks
- **Rate Limiting**: Prevents API abuse and accidental rapid-fire requests
- **Secure Migration**: Automatic migration of API keys from settings to SecretStorage
- **No Sensitive Data Logging**: API keys never logged or exposed in error messages
- **Static Security Scanning**: Built-in security scanner detects vulnerabilities before deployment
- **Security Diagnostics**: VS Code diagnostics integration for security issues
- **AI-Powered Security Analysis**: Get detailed explanations and fixes for security issues

### ⚙️ Configuration
Highly configurable via VS Code settings:

- **Base URL**: Default base URL for API requests
- **Timeout**: Request timeout in milliseconds (default: 30000)
- **Caching**: Enable/disable response caching with configurable TTL
- **Retry Settings**: Configure retry attempts and delays
- **AI Provider**: Choose between OpenAI, Anthropic, or Custom
- **AI Model**: Select AI model (e.g., gpt-4, gpt-3.5-turbo, claude-3)
- **Size Limits**: Configure request body and response size limits
- **Framework Detection**: Enable/disable automatic framework detection
- **CodeLens**: Enable/disable CodeLens for route detection
- **Security Scanning**: Enable/disable security scanning in workspace analysis
- **Workspace Scanning**: Enable/disable workspace-level code health scanning
- **Max Workspace Files**: Maximum files to analyze per workspace scan (default: 10000)
- **Complexity Thresholds**: Configure high (default: 10) and critical (default: 20) complexity thresholds

## 📦 Installation

### From VS Code Marketplace (Recommended)
1. Open **VS Code**.
2. Go to the **Extensions** view (`Ctrl+Shift+X` or `Cmd+Shift+X`).
3. Search for **BunnyAI Pro**.
4. Click **Install**.

**Or install directly:**
- [Install from Marketplace](https://marketplace.visualstudio.com/items?itemName=VishalNandy17.bunnyai-pro)

## 📖 Usage

### Running API Requests
1. Open a supported file (e.g., `server.ts`, `app.py`).
2. Click the **Run API** CodeLens appearing above your route definitions.
3. The **BunnyAI Request Panel** will open with method and URL pre-filled.
4. Add headers or modify request body if needed.
5. Click **Send Request** to execute.
6. View the response in the panel with status, duration, and size metrics.

### Generating Tests
1. Select the code you want to generate tests for.
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac).
3. Run **"BunnyAI: Generate Tests"**.
4. The AI will generate comprehensive tests in a new document.

**Note**: Requires AI API key configuration (see below).

### Analyzing Errors
1. Select an error message in your editor.
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac).
3. Run **"BunnyAI: Analyze Error"**.
4. Receive an AI-generated analysis with explanations and solutions.

**Note**: Requires AI API key configuration (see below).

### Generating Documentation
1. Select the code you want to document.
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac).
3. Run **"BunnyAI: Generate Documentation"**.
4. Documentation will be inserted above the selected code.

**Note**: Requires AI API key configuration (see below).

### Configuring AI API Key
1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac).
2. Run **"BunnyAI: Configure AI API Key"**.
3. Enter your OpenAI, Anthropic, or custom API key.
4. The key will be stored securely in VS Code's SecretStorage.

**Get API Keys:**
- **OpenAI**: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Anthropic**: [console.anthropic.com](https://console.anthropic.com/)

### Analyzing Code Quality
1. Open a TypeScript or JavaScript file.
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac).
3. Run **"BunnyAI: Analyze Code Quality"**.
4. View complexity metrics and maintainability grades in the Code Quality panel.
5. See diagnostics highlighting complex functions directly in your editor.

### Reviewing & Refactoring Code
1. Select the code you want to review.
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac).
3. Run **"BunnyAI: Review & Refactor Selection"**.
4. Review the AI-generated feedback and refactored code suggestion.
5. Apply the refactored code if desired.

**Note**: Requires AI API key configuration (see above).

### Removing Comments
1. Select code with comments (or leave unselected to process entire file).
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac).
3. Run **"BunnyAI: Remove Comments from Selection"**.
4. Comments are removed while preserving strings and template literals.
5. Use undo (`Ctrl+Z`) if needed.

### Scanning for Security Issues
1. Open a file you want to scan.
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac).
3. Run **"BunnyAI: Security Scan File"**.
4. View security issues as VS Code diagnostics.
5. Check the output channel for detailed issue information.
6. (Optional) Run **"BunnyAI: Explain Security Issues (with AI)"** for detailed explanations.

**Note**: AI explanations require AI API key configuration.

### Analyzing Workspace Code Health
1. Open a workspace folder.
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac).
3. Run **"BunnyAI: Analyze Workspace Code Health"**.
4. Choose whether to include security scanning.
5. Monitor progress (scan can be cancelled).
6. View results in the interactive dashboard:
   - Summary metrics (files scanned, average complexity, security issues)
   - Worst offender files (highest complexity)
   - Top 10 most complex functions
   - Security issues grouped by severity
7. Click any file or function to navigate directly to it.
8. View last scan summary in the Code Health sidebar view.

## 🔒 Security Considerations

### API Key Storage
- **Secure Storage**: AI API keys are stored using VS Code's SecretStorage API, which provides encrypted storage
- **Migration**: Existing API keys in settings are automatically migrated to SecretStorage
- **Configuration**: Use the `BunnyAI: Configure AI API Key` command to securely manage your API keys

### URL Validation
- Only `http://` and `https://` protocols are allowed for API requests
- Invalid protocols are rejected with clear error messages
- Prevents SSRF (Server-Side Request Forgery) attacks

### Size Limits
- **Request Body**: Limited to 1MB by default (configurable)
- **Response Size**: Limited to 10MB by default (configurable)
- Prevents memory exhaustion and DoS attacks

### Rate Limiting
- AI API calls are rate-limited (minimum 500ms between calls)
- Prevents accidental rapid-fire requests and API abuse

### Best Practices
1. Always use HTTPS for production APIs
2. Store API keys securely using the provided command
3. Review size limits based on your use case
4. Monitor API usage to prevent abuse

## ⚙️ Configuration

Open VS Code Settings (`Ctrl+,`) and search for "BunnyAI" to configure:

- **Base URL**: Default base URL for API requests
- **Timeout**: Request timeout in milliseconds (default: 30000)
- **Caching**: Enable/disable response caching with configurable TTL
- **Retry**: Configure retry attempts and delays
- **AI Provider**: Choose between OpenAI, Anthropic, or Custom
- **AI Model**: Model name (e.g., gpt-4, gpt-3.5-turbo, claude-3)
- **Size Limits**: Configure request body and response size limits
- **Framework Detection**: Enable/disable automatic framework detection
- **CodeLens**: Enable/disable CodeLens for route detection
- **Security Scanning**: Enable/disable security scanning (default: enabled)
- **Workspace Scanning**: Enable/disable workspace code health scanning (default: enabled)
- **Max Workspace Files**: Maximum files to analyze per scan (default: 10000)
- **Complexity Thresholds**: High complexity (default: 10) and critical (default: 20) thresholds

See [HOW_TO_RUN.md](HOW_TO_RUN.md) for detailed configuration instructions.

## 🧪 Testing

### Automated Tests
```bash
npm test
```

Runs comprehensive test suite covering:
- HTTP Client (validation, size limits, timeouts)
- API Executor (request execution, error handling)
- Middleware (Auth, Retry, Cache)
- Config Manager
- Express Parser
- Extension activation

See [TESTING_GUIDE.md](TESTING_GUIDE.md) for comprehensive testing instructions.

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

**Copyright (c) 2025 Vishal Nandy**

---

**Made by [Vishal Nandy](https://github.com/VishalNandy17)**

[![GitHub](https://img.shields.io/badge/GitHub-Repository-black?style=flat-square&logo=github)](https://github.com/VishalNandy17/BunnyAI)
[![Marketplace](https://img.shields.io/badge/Marketplace-Extension-blue?style=flat-square&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=VishalNandy17.bunnyai-pro)
[![Issues](https://img.shields.io/github/issues/VishalNandy17/BunnyAI?style=flat-square&logo=github)](https://github.com/VishalNandy17/BunnyAI/issues)
