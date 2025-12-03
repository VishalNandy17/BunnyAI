import * as vscode from 'vscode';
import { ParsedError } from '../../runtime/logParser';
import { RuntimeDiagnosis } from '../../ai/AIRuntimeDiagnoser';

export interface RuntimeDiagnosticsData {
    error: ParsedError;
    diagnosis?: RuntimeDiagnosis;
    sourceCode?: string;
    filePath?: string;
}

export class RuntimeDiagnosticsPanel {
    private static currentPanel: RuntimeDiagnosticsPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _data: RuntimeDiagnosticsData | undefined;

    public static show(
        extensionUri: vscode.Uri,
        data: RuntimeDiagnosticsData
    ) {
        if (RuntimeDiagnosticsPanel.currentPanel) {
            RuntimeDiagnosticsPanel.currentPanel.update(data);
            RuntimeDiagnosticsPanel.currentPanel.reveal();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'bunnyaiRuntimeDiagnostics',
            'Runtime Diagnostics',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
                retainContextWhenHidden: true
            }
        );

        RuntimeDiagnosticsPanel.currentPanel = new RuntimeDiagnosticsPanel(panel, extensionUri);
        RuntimeDiagnosticsPanel.currentPanel.update(data);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'openFile':
                        await this.openFile(message.filePath, message.line);
                        break;
                }
            },
            null,
            this._disposables
        );

        this._panel.webview.html = this.getHtml();
    }

    private async openFile(filePath: string, line?: number) {
        try {
            const uri = vscode.Uri.file(filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(document);

            if (line !== undefined && line > 0) {
                const position = new vscode.Position(line - 1, 0);
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open file: ${filePath}`);
        }
    }

    private reveal() {
        this._panel.reveal(undefined, true);
    }

    private update(data: RuntimeDiagnosticsData) {
        this._data = data;
        this._panel.webview.postMessage({
            type: 'diagnostics',
            payload: data
        });
    }

    private dispose() {
        RuntimeDiagnosticsPanel.currentPanel = undefined;
        this._disposables.forEach(d => d.dispose());
    }

    private getHtml(): string {
        const nonce = this.getNonce();
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; img-src ${this._panel.webview.cspSource} https:; style-src ${this._panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Runtime Diagnostics</title>
    <style>
        :root {
            color-scheme: light dark;
        }
        body {
            font-family: var(--vscode-font-family);
            margin: 0;
            padding: 16px;
            color: var(--vscode-editor-foreground);
            background: var(--vscode-editor-background);
        }
        h1 {
            font-size: 1.5rem;
            margin-bottom: 1rem;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 0.5rem;
        }
        h2 {
            font-size: 1.2rem;
            margin-top: 1.5rem;
            margin-bottom: 0.75rem;
        }
        .error-header {
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-errorForeground);
            border-radius: 4px;
            padding: 16px;
            margin-bottom: 1.5rem;
        }
        .error-type {
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--vscode-errorForeground);
            margin-bottom: 8px;
        }
        .error-message {
            color: var(--vscode-editor-foreground);
            margin-bottom: 12px;
        }
        .stack-trace {
            background: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 12px;
            font-family: var(--vscode-editor-font-family);
            font-size: 0.875rem;
            overflow-x: auto;
            white-space: pre-wrap;
            max-height: 300px;
            overflow-y: auto;
        }
        .stack-frame {
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 4px;
            padding: 12px;
            margin-bottom: 8px;
        }
        .stack-frame-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        .stack-frame-file {
            font-weight: 600;
            color: var(--vscode-textLink-foreground);
            cursor: pointer;
        }
        .stack-frame-file:hover {
            text-decoration: underline;
        }
        .stack-frame-location {
            color: var(--vscode-descriptionForeground);
            font-size: 0.875rem;
        }
        .diagnosis-section {
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 4px;
            padding: 16px;
            margin-bottom: 1rem;
        }
        .diagnosis-section h3 {
            margin-top: 0;
            margin-bottom: 12px;
            font-size: 1rem;
        }
        .confidence-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
            margin-left: 8px;
        }
        .confidence-high {
            background: var(--vscode-textLink-foreground);
            color: white;
        }
        .confidence-medium {
            background: var(--vscode-textBlockQuote-border);
            color: white;
        }
        .confidence-low {
            background: var(--vscode-descriptionForeground);
            color: white;
        }
        .code-block {
            background: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 12px;
            font-family: var(--vscode-editor-font-family);
            font-size: 0.875rem;
            overflow-x: auto;
            margin-top: 8px;
        }
        .test-case {
            background: var(--vscode-textBlockQuote-background);
            border-left: 3px solid var(--vscode-textLink-foreground);
            padding: 8px 12px;
            margin: 8px 0;
        }
        .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
            margin-right: 8px;
        }
        .badge-error {
            background: var(--vscode-errorForeground);
            color: white;
        }
        .badge-warning {
            background: var(--vscode-textBlockQuote-border);
            color: white;
        }
        .badge-info {
            background: var(--vscode-textLink-foreground);
            color: white;
        }
    </style>
</head>
<body>
    <h1>Runtime Diagnostics</h1>
    <div id="content"></div>
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        let currentData = null;

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'diagnostics') {
                currentData = message.payload;
                renderDiagnostics(currentData);
            }
        });

        function renderDiagnostics(data) {
            const container = document.getElementById('content');
            container.innerHTML = \`
                \${renderError(data.error)}
                \${renderStackFrames(data.error.stackFrames)}
                \${data.diagnosis ? renderDiagnosis(data.diagnosis) : '<p>No diagnosis available. Run "BunnyAI: Diagnose Runtime Error" to get AI analysis.</p>'}
            \`;
        }

        function renderError(error) {
            return \`
                <div class="error-header">
                    <div class="error-type">
                        <span class="badge badge-error">\${error.severity.toUpperCase()}</span>
                        \${escapeHtml(error.type)}
                    </div>
                    <div class="error-message">\${escapeHtml(error.message)}</div>
                    \${error.timestamp ? '<div style="font-size: 0.875rem; color: var(--vscode-descriptionForeground);">' + escapeHtml(error.timestamp) + '</div>' : ''}
                    \${error.repeatedPattern ? '<div style="font-size: 0.875rem; color: var(--vscode-textBlockQuote-border); margin-top: 8px;">⚠ Repeated ' + error.repeatedPattern.count + ' times</div>' : ''}
                </div>
            \`;
        }

        function renderStackFrames(frames) {
            if (frames.length === 0) {
                return '<h2>Stack Trace</h2><div class="stack-trace">No stack frames available</div>';
            }

            return \`
                <h2>Stack Trace</h2>
                \${frames.map((frame, idx) => \`
                    <div class="stack-frame">
                        <div class="stack-frame-header">
                            <div>
                                <span class="stack-frame-file" onclick="openFile('\${frame.file || ''}', \${frame.line || 0})">
                                    \${escapeHtml(frame.file || '<unknown>')}
                                </span>
                                \${frame.function ? '<span style="color: var(--vscode-descriptionForeground); margin-left: 8px;">' + escapeHtml(frame.function) + '</span>' : ''}
                            </div>
                            <div class="stack-frame-location">
                                \${frame.line ? 'Line ' + frame.line : ''}
                                \${frame.column ? ':' + frame.column : ''}
                            </div>
                        </div>
                        \${frame.code ? '<div class="code-block">' + escapeHtml(frame.code) + '</div>' : ''}
                    </div>
                \`).join('')}
            \`;
        }

        function renderDiagnosis(diagnosis) {
            const confidenceClass = \`confidence-\${diagnosis.confidence}\`;
            return \`
                <h2>AI Diagnosis <span class="confidence-badge \${confidenceClass}">\${diagnosis.confidence.toUpperCase()}</span></h2>
                
                <div class="diagnosis-section">
                    <h3>Root Cause Analysis</h3>
                    <p>\${escapeHtml(diagnosis.rootCause)}</p>
                </div>

                <div class="diagnosis-section">
                    <h3>Likely Fix</h3>
                    <div class="code-block">\${escapeHtml(diagnosis.likelyFix)}</div>
                </div>

                <div class="diagnosis-section">
                    <h3>Prevention Strategy</h3>
                    <p>\${escapeHtml(diagnosis.preventionStrategy)}</p>
                </div>

                <div class="diagnosis-section">
                    <h3>Test Cases to Catch This</h3>
                    \${diagnosis.testCases.map(test => \`
                        <div class="test-case">\${escapeHtml(test)}</div>
                    \`).join('')}
                </div>
            \`;
        }

        function openFile(filePath, line) {
            if (!filePath) return;
            vscode.postMessage({
                command: 'openFile',
                filePath: filePath,
                line: line
            });
        }

        function escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    </script>
</body>
</html>`;
    }

    private getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}

