import * as vscode from 'vscode';
import { IRoute } from '../../types';

export class RequestPanel {
    public static currentPanel: RequestPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
    }

    public static createOrShow(extensionUri: vscode.Uri, route?: IRoute) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (RequestPanel.currentPanel) {
            RequestPanel.currentPanel._panel.reveal(column);
            if (route) {
                RequestPanel.currentPanel.update(route);
            }
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'bunnyaiRequest',
            'BunnyAI Request',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
            }
        );

        RequestPanel.currentPanel = new RequestPanel(panel, extensionUri);
        if (route) {
            RequestPanel.currentPanel.update(route);
        }
    }

    public update(route: IRoute) {
        this._panel.webview.postMessage({ command: 'setRoute', route });
    }

    public dispose() {
        RequestPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>BunnyAI Request</title>
            <style>
                body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-editor-foreground); }
                .input-group { margin-bottom: 15px; }
                label { display: block; margin-bottom: 5px; }
                input, select, textarea { width: 100%; padding: 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); }
                button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); padding: 10px 20px; border: none; cursor: pointer; }
                button:hover { background: var(--vscode-button-hoverBackground); }
                pre { background: var(--vscode-editor-background); padding: 10px; border: 1px solid var(--vscode-editor-border); }
            </style>
        </head>
        <body>
            <h2>Send API Request</h2>
            <div class="input-group">
                <label>Method</label>
                <select id="method">
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                </select>
            </div>
            <div class="input-group">
                <label>URL</label>
                <input type="text" id="url" placeholder="http://localhost:3000/api/...">
            </div>
            <div class="input-group">
                <button id="send">Send Request</button>
            </div>
            <div id="response">
                <h3>Response</h3>
                <pre id="response-body">Waiting for request...</pre>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                
                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.command === 'setRoute') {
                        document.getElementById('method').value = message.route.method;
                        document.getElementById('url').value = 'http://localhost:3000' + message.route.path;
                    }
                });

                document.getElementById('send').addEventListener('click', () => {
                    document.getElementById('response-body').innerText = 'Sending...';
                    // In a real app, you'd send a message back to the extension to execute the request
                    setTimeout(() => {
                         document.getElementById('response-body').innerText = '{\\n  "status": "success",\\n  "message": "This is a simulated response"\\n}';
                    }, 1000);
                });
            </script>
        </body>
        </html>`;
    }
}
