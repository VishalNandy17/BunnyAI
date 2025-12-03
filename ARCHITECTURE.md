BunnyAI Pro Architecture
========================

High-Level View
---------------
```
[VS Code Host]
    |
    | activates + dispatches commands
    v
[src/extension.ts]
    |
    | bootstraps
    v
[ExtensionCore (src/core/ExtensionCore.ts)]
    |-- Providers (CodeLens, Tree Data)
    |-- WebviewManager (src/webview/WebviewManager.ts)
    |-- History & Collections
    |
    +--> [AI Services (src/ai/*)]
    |        |
    |        -> AIProvider -> HttpClient
    |
    +--> [RequestPanel Webview]
             |
             -> APIExecutor -> Middleware -> HttpClient
```

Module Overview
---------------
- `src/extension.ts`: Entry point. Initializes storage, configuration, framework detection, registers commands/status UI, and wires AI services and the `RequestPanel`.
- `src/core/ExtensionCore.ts`: Manages lifecycle of providers (`CodeLensProvider`, `RouteTreeDataProvider`, `HistoryTreeProvider`, `CollectionProvider`) and registers them with VS Code.
- `src/core/APIExecutor.ts`: Normalizes outbound HTTP requests, applying middleware (`AuthMiddleware`, `RetryMiddleware`, `CacheMiddleware`) before delegating to `HttpClient`.
- `src/webview/WebviewManager.ts` & `src/webview/panels/RequestPanel.ts`: Host the request builder/response viewer used for running API routes, including message handling and persistence hooks.
- `src/ai/*` (`AITestGenerator`, `AIErrorAnalyzer`, `AIDocGenerator`, `AIProvider`): Thin wrappers over `AIProvider`, which reads settings/secret storage, builds prompts, and calls OpenAI/Anthropic/custom endpoints through `HttpClient`.
- `src/parsers/*`: AST-based route detectors per backend framework (Express parser currently wired) used by both CodeLens and the Requests tree.
- `src/providers/*`: UI surface providers—`CodeLensProvider` injects run buttons above routes, `RouteTreeDataProvider` lists detected routes, `HistoryTreeProvider` & `CollectionProvider` back the sidebar views.
- `src/middleware/*`: Cross-cutting middleware for API execution (authentication placeholders, caching, retry/backoff).
- `src/storage/*`: Adapters over VS Code workspace/global/secret storage used by history, collections, and secure credential handling.
- `src/utils/*`: Shared utilities (logging, HTTP client, request helpers).
- `webview/` & `media/`: Static assets (HTML/CSS/JS) bundled into the webview panels.
- `test/` + `src/testing/`: Mocha-based integration suite and lightweight test harness components.
- `out/` & `dist/`: Transpiled JavaScript artifacts and packaged bundle consumed by VS Code.

Key Subsystems
--------------
- **API Client & Request Panel**: `RequestPanel` (webview) gathers user input, calls `APIExecutor`, and persists responses via `HistoryManager`. `APIExecutor` chains middleware and finally calls `HttpClient` for network IO.
- **AI Features**: Commands instantiate `AITestGenerator`, `AIErrorAnalyzer`, or `AIDocGenerator`. Each funnels into `AIProvider`, which selects the configured provider/model, fetches API keys from `SecretStorage`, constructs prompts, and issues HTTPS calls.
- **Route Detection & CodeLens**: `ExpressParser` inspects the active document’s AST to enumerate HTTP routes. `RouteTreeDataProvider` and `CodeLensProvider` share this parser to populate the Requests tree and inline CodeLens entries (both trigger `bunnyai.runApi`).
- **Configuration & Middleware**: `ConfigManager` watches `bunnyai.*` settings and feeds values into middleware, AI services, and route tooling (e.g., enabling CodeLens, cache TTLs, retry behavior).
- **History & Collections**: `HistoryManager` records executed requests/responses in workspace storage, surfaced via `HistoryTreeProvider`. `CollectionManager` (in `src/core/CollectionManager.ts`) groups saved calls for re-use.
- **Testing**: `test/runTest.ts` boots the VS Code test runner. `src/testing/*` provides assertion and reporting utilities, while `test/suite` holds scenario coverage for parsers, middleware, and providers.

Command Registration
--------------------
- Declared in `package.json` under `contributes.commands` (`bunnyai.runApi`, `bunnyai.generateTests`, `bunnyai.analyzeError`, `bunnyai.generateDocs`, `bunnyai.configureApiKey`).
- Registered during activation inside `src/extension.ts`, where each command wraps the relevant subsystem (webview opening, AI invocation, status updates, history management).

Data Flow Scenarios
-------------------
### Running an API request from a detected route
1. Route is identified by `ExpressParser` and surfaced either via `CodeLensProvider` or `RouteTreeDataProvider`.
2. User selects a route, triggering `vscode.commands.executeCommand('bunnyai.runApi', route)` as registered in `src/extension.ts`.
3. Command forwards the route to `WebviewManager.getInstance().openRequestPanel(route)`, which opens the `RequestPanel` webview pre-filled with method/path.
4. Inside the webview, clicking *Send* posts a `sendRequest` message. `RequestPanel` converts it into an `IRequest`, invokes `APIExecutor.execute()`, and streams progress back to the webview.
5. `APIExecutor` passes the request through middleware (auth, retry, cache) and eventually `HttpClient`. Responses are returned to the panel, persisted via `HistoryManager`, and UI providers (History tree) are refreshed.

### Calling an AI feature from the command palette
1. User invokes a contributed command (`bunnyai.generateTests`, `bunnyai.generateDocs`, or `bunnyai.analyzeError`).
2. `src/extension.ts` validates the active editor selection, shows a progress notification, and calls the matching AI service (`AITestGenerator`, `AIDocGenerator`, `AIErrorAnalyzer`).
3. AI service delegates to `AIProvider`, which retrieves configuration (provider/model) and secret API keys, constructs the appropriate prompt, and submits it via `HttpClient` to OpenAI/Anthropic/custom endpoints.
4. Responses are surfaced back to the user (new editor document for tests/docs, markdown doc for error analysis). Errors are caught and surfaced via VS Code notifications.

Tone and Style
--------------
This document intentionally favors concise, production-focused language suitable for onboarding engineers and reviewers.

