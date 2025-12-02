# 🐰 BunnyAI Pro — Production-Ready VS Code Extension

[![Version](https://img.shields.io/visual-studio-marketplace/v/bunnyai.bunnyai-pro?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=bunnyai.bunnyai-pro)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/bunnyai.bunnyai-pro?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=bunnyai.bunnyai-pro)
[![License](https://img.shields.io/github/license/bunnyai/bunnyai-pro?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)

**BunnyAI Pro** is a comprehensive, enterprise-grade VS Code extension designed to supercharge your development workflow. Built with a robust TypeScript architecture, it combines advanced AI capabilities with powerful API testing tools, supporting a wide array of modern web frameworks.

## ✨ Features

### 🚀 Multi-Framework Support
Seamlessly parse, analyze, and generate tests for your favorite frameworks:
- **Node.js**: Express, NestJS, GraphQL
- **Python**: FastAPI, Django, Flask
- **Java**: Spring Boot
- **PHP**: Laravel
- **Go**: Gin

### 🤖 Advanced AI Integration
Leverage the power of AI to automate tedious tasks:
- **Smart Test Generation**: Automatically generate unit and integration tests (`AITestGenerator.ts`).
- **Auto-Documentation**: Create comprehensive API documentation instantly (`AIDocGenerator.ts`).
- **Intelligent Error Analysis**: Get actionable insights and fixes for runtime errors (`AIErrorAnalyzer.ts`).
- **Response Validation**: AI-driven validation of API responses against schemas (`AIResponseValidator.ts`).

### ⚡ Built-in API Client
A full-featured API client right inside VS Code:
- **Interactive Panels**: Dedicated Request, Response, and History panels.
- **Environment Management**: Manage variables and secrets securely.
- **Collections**: Organize your requests efficiently.
- **History**: Never lose track of your API interactions.

### 🛠️ Developer Productivity
- **CodeLens Integration**: Run API endpoints directly from your code files.
- **Hover Information**: Get instant context about routes and controllers.
- **Tree Views**: Navigate your API routes, history, and collections via the sidebar.

## 📦 Installation

1. Open **VS Code**.
2. Go to the **Extensions** view (`Ctrl+Shift+X` or `Cmd+Shift+X`).
3. Search for **BunnyAI Pro**.
4. Click **Install**.

## 📖 Usage

### Running API Requests
1. Open a supported file (e.g., `server.ts`, `app.py`).
2. Click the **Run API** CodeLens appearing above your route definitions.
3. View the results in the **BunnyAI Response Panel**.

### Generating Tests
1. Right-click on a controller or route handler.
2. Select **BunnyAI: Generate Tests**.
3. The AI will generate a test file in your `test/` directory.

### Analyzing Errors
1. Select an error log in the Output panel.
2. Right-click and choose **BunnyAI: Analyze Error**.
3. Receive an AI-generated explanation and potential fix.

## 📁 Project Structure

The extension is built with a modular, scalable architecture:

```
bunnyai-pro/
├── package.json
├── tsconfig.json
├── webpack.config.js
├── .vscodeignore
├── .eslintrc.json
├── .prettierrc
├── README.md
├── CHANGELOG.md
├── LICENSE
│
├── src/
│   ├── extension.ts                    # Main entry point
│   ├── types/                          # Type definitions
│   │   ├── index.ts
│   │   ├── api.types.ts
│   │   ├── parser.types.ts
│   │   └── config.types.ts
│   │
│   ├── core/                           # Core business logic
│   │   ├── ExtensionCore.ts            # Core orchestrator
│   │   ├── APIExecutor.ts              # HTTP request handler
│   │   ├── EnvironmentManager.ts       # Env variable management
│   │   ├── CollectionManager.ts        # API collections
│   │   └── HistoryManager.ts           # Request history
│   │
│   ├── parsers/                        # Framework-specific parsers
│   │   ├── BaseParser.ts
│   │   ├── ExpressParser.ts
│   │   ├── FastAPIParser.ts
│   │   ├── DjangoParser.ts
│   │   ├── FlaskParser.ts
│   │   ├── SpringBootParser.ts
│   │   ├── LaravelParser.ts
│   │   ├── NestJSParser.ts
│   │   ├── GoGinParser.ts
│   │   └── GraphQLParser.ts
│   │
│   ├── ai/                             # AI capabilities
│   │   ├── AITestGenerator.ts          # AI-powered test generation
│   │   ├── AIDocGenerator.ts           # Auto documentation
│   │   ├── AIErrorAnalyzer.ts          # Smart error analysis
│   │   └── AIResponseValidator.ts      # Response validation
│   │
│   ├── providers/                      # VS Code UI providers
│   │   ├── RouteTreeDataProvider.ts    # Tree view for routes
│   │   ├── HistoryTreeProvider.ts      # History tree view
│   │   ├── CollectionProvider.ts       # Collections tree view
│   │   ├── CodeLensProvider.ts         # Inline "Run" buttons
│   │   └── HoverProvider.ts            # Hover info
│   │
│   ├── webview/                        # Webview UI components
│   │   ├── WebviewManager.ts
│   │   ├── panels/
│   │   │   ├── RequestPanel.ts
│   │   │   ├── ResponsePanel.ts
│   │   │   ├── HistoryPanel.ts
│   │   │   └── EnvironmentPanel.ts
│   │   └── templates/
│   │       ├── request.html
│   │       ├── response.html
│   │       └── shared.css
│   │
│   ├── commands/                       # VS Code commands
│   │   ├── RunAPICommand.ts
│   │   ├── GenerateTestsCommand.ts
│   │   ├── ExportCollectionCommand.ts
│   │   ├── ImportCommand.ts
│   │   └── GenerateDocsCommand.ts
│   │
│   ├── utils/                          # Utilities
│   │   ├── logger.ts
│   │   ├── validator.ts
│   │   ├── formatter.ts
│   │   ├── cryptoHelper.ts
│   │   ├── fileHelper.ts
│   │   └── httpClient.ts
│   │
│   ├── storage/                        # Data persistence
│   │   ├── WorkspaceStorage.ts
│   │   ├── GlobalStorage.ts
│   │   └── SecretStorage.ts
│   │
│   ├── middleware/                     # Request pipeline
│   │   ├── AuthMiddleware.ts
│   │   ├── RetryMiddleware.ts
│   │   └── CacheMiddleware.ts
│   │
│   └── testing/                        # Internal testing tools
│       ├── TestRunner.ts
│       ├── AssertionEngine.ts
│       └── TestReporter.ts
│
├── media/                              # Static assets
│   ├── icons/
│   │   ├── bunny.svg
│   │   ├── get.svg
│   │   ├── post.svg
│   │   └── ...
│   ├── styles/
│   │   ├── main.css
│   │   ├── themes/
│   │   │   ├── dark.css
│   │   │   └── light.css
│   │   └── components.css
│   └── scripts/
│       ├── webview.js
│       └── monaco-editor.js
│
├── resources/                          # Templates and snippets
│   ├── templates/
│   │   ├── test-template.ts
│   │   ├── mock-server.js
│   │   └── docs-template.md
│   └── snippets/
│       └── bunnyai.json
│
└── test/                               # Extension tests
    ├── suite/
    │   ├── extension.test.ts
    │   ├── parsers.test.ts
    │   └── api.test.ts
    └── fixtures/
        └── sample-projects/
```

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
- **Size Limits**: Configure request body and response size limits
- **Framework Detection**: Enable/disable automatic framework detection

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

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Made with ❤️ by the BunnyAI Team