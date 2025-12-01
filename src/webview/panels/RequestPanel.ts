import * as vscode from 'vscode';
import { IRoute, IRequest, IResponse } from '../../types';
import { APIExecutor } from '../../core/APIExecutor';
import { HistoryManager } from '../../core/HistoryManager';
import { Logger } from '../../utils/logger';
// Using simple ID generator instead of uuid

interface WebviewMessage {
    command: string;
    data?: any;
}

export class RequestPanel {
    public static currentPanel: RequestPanel | undefined;
    private static onRequestExecuted: (() => void) | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _apiExecutor: APIExecutor;
    private readonly _historyManager: HistoryManager;
    private _disposables: vscode.Disposable[] = [];

    public static setOnRequestExecuted(callback: () => void): void {
        RequestPanel.onRequestExecuted = callback;
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._apiExecutor = new APIExecutor();
        this._historyManager = HistoryManager.getInstance();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

        // Handle messages from webview
        this._panel.webview.onDidReceiveMessage(
            async (message: WebviewMessage) => {
                try {
                    await this.handleMessage(message);
                } catch (error) {
                    Logger.error('Error handling webview message', error);
                    this._panel.webview.postMessage({
                        command: 'error',
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            },
            null,
            this._disposables
        );
    }

    private async handleMessage(message: WebviewMessage): Promise<void> {
        switch (message.command) {
            case 'sendRequest':
                await this.handleSendRequest(message.data);
                break;
            case 'clearResponse':
                this._panel.webview.postMessage({ command: 'clearResponse' });
                break;
            default:
                Logger.log(`Unknown command: ${message.command}`);
        }
    }

    private async handleSendRequest(requestData: { method: string; url: string; headers?: Record<string, string>; body?: any }): Promise<void> {
        try {
            // Show loading state
            this._panel.webview.postMessage({
                command: 'response',
                response: { loading: true }
            });

            // Create request object
            const request: IRequest = {
                id: this.generateId(),
                url: requestData.url,
                method: requestData.method,
                headers: requestData.headers || {},
                body: requestData.body,
                timestamp: Date.now()
            };

            // Execute request
            const response = await this._apiExecutor.execute(request);

            // Save to history
            await this._historyManager.addRequest(request, response);

            // Notify extension to refresh history tree
            if (RequestPanel.onRequestExecuted) {
                RequestPanel.onRequestExecuted();
            }

            // Send response to webview
            this._panel.webview.postMessage({
                command: 'response',
                response: {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers,
                    data: response.data,
                    duration: response.duration,
                    size: response.size,
                    loading: false
                }
            });

        } catch (error: any) {
            Logger.error('Request execution failed', error);
            this._panel.webview.postMessage({
                command: 'response',
                response: {
                    status: 0,
                    statusText: 'Error',
                    error: error.message || 'Request failed',
                    loading: false
                }
            });
        }
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
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
                retainContextWhenHidden: true
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
        const nonce = this._getNonce();
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
            <title>BunnyAI Request</title>
            <style>
                body { 
                    font-family: var(--vscode-font-family); 
                    padding: 20px; 
                    color: var(--vscode-editor-foreground);
                    background: var(--vscode-editor-background);
                }
                .input-group { margin-bottom: 15px; }
                label { display: block; margin-bottom: 5px; font-weight: 500; }
                input, select, textarea { 
                    width: 100%; 
                    padding: 8px; 
                    background: var(--vscode-input-background); 
                    color: var(--vscode-input-foreground); 
                    border: 1px solid var(--vscode-input-border);
                    box-sizing: border-box;
                }
                textarea {
                    min-height: 100px;
                    font-family: var(--vscode-editor-font-family);
                }
                button { 
                    background: var(--vscode-button-background); 
                    color: var(--vscode-button-foreground); 
                    padding: 10px 20px; 
                    border: none; 
                    cursor: pointer;
                    margin-right: 10px;
                }
                button:hover { background: var(--vscode-button-hoverBackground); }
                button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .response-section {
                    margin-top: 20px;
                    padding-top: 20px;
                    border-top: 1px solid var(--vscode-editor-border);
                }
                .response-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                }
                .status-badge {
                    padding: 4px 8px;
                    border-radius: 3px;
                    font-size: 12px;
                    font-weight: bold;
                }
                .status-2xx { background: #4caf50; color: white; }
                .status-4xx { background: #ff9800; color: white; }
                .status-5xx { background: #f44336; color: white; }
                .status-error { background: #9e9e9e; color: white; }
                pre { 
                    background: var(--vscode-editor-background); 
                    padding: 10px; 
                    border: 1px solid var(--vscode-editor-border);
                    border-radius: 3px;
                    overflow-x: auto;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }
                .loading {
                    opacity: 0.6;
                }
                .error {
                    color: var(--vscode-errorForeground);
                    background: var(--vscode-inputValidation-errorBackground);
                    padding: 10px;
                    border-radius: 3px;
                    margin-top: 10px;
                }
                .info {
                    color: var(--vscode-descriptionForeground);
                    font-size: 12px;
                    margin-top: 5px;
                }
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
                    <option value="PATCH">PATCH</option>
                    <option value="DELETE">DELETE</option>
                </select>
            </div>
            <div class="input-group">
                <label>URL</label>
                <input type="text" id="url" placeholder="http://localhost:3000/api/...">
                <div class="info">Enter the full URL including protocol (http:// or https://)</div>
            </div>
            <div class="input-group" id="body-group" style="display: none;">
                <label>Request Body (JSON)</label>
                <textarea id="body" placeholder='{"key": "value"}'></textarea>
            </div>
            <div class="input-group">
                <button id="send">Send Request</button>
                <button id="clear">Clear</button>
            </div>
            <div class="response-section" id="response-section" style="display: none;">
                <div class="response-header">
                    <h3>Response</h3>
                    <div id="status-badge"></div>
                </div>
                <div class="info" id="response-info"></div>
                <pre id="response-body"></pre>
            </div>

            <script nonce="${nonce}">
                const vscode = acquireVsCodeApi();
                let currentMethod = 'GET';
                
                // Update body field visibility based on method
                document.getElementById('method').addEventListener('change', (e) => {
                    currentMethod = e.target.value;
                    const bodyGroup = document.getElementById('body-group');
                    if (['POST', 'PUT', 'PATCH'].includes(currentMethod)) {
                        bodyGroup.style.display = 'block';
                    } else {
                        bodyGroup.style.display = 'none';
                    }
                });
                
                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.command === 'setRoute') {
                        document.getElementById('method').value = message.route.method;
                        document.getElementById('url').value = 'http://localhost:3000' + message.route.path;
                        currentMethod = message.route.method;
                        if (['POST', 'PUT', 'PATCH'].includes(currentMethod)) {
                            document.getElementById('body-group').style.display = 'block';
                        }
                    } else if (message.command === 'response') {
                        displayResponse(message.response);
                    } else if (message.command === 'clearResponse') {
                        clearResponse();
                    } else if (message.command === 'error') {
                        displayError(message.error);
                    }
                });

                function displayResponse(response) {
                    const section = document.getElementById('response-section');
                    const body = document.getElementById('response-body');
                    const statusBadge = document.getElementById('status-badge');
                    const info = document.getElementById('response-info');
                    const sendButton = document.getElementById('send');
                    
                    section.style.display = 'block';
                    sendButton.disabled = response.loading || false;
                    
                    if (response.loading) {
                        body.innerText = 'Sending request...';
                        body.classList.add('loading');
                        return;
                    }
                    
                    body.classList.remove('loading');
                    
                    if (response.error) {
                        displayError(response.error);
                        return;
                    }
                    
                    // Status badge
                    const status = response.status || 0;
                    let badgeClass = 'status-error';
                    if (status >= 200 && status < 300) badgeClass = 'status-2xx';
                    else if (status >= 400 && status < 500) badgeClass = 'status-4xx';
                    else if (status >= 500) badgeClass = 'status-5xx';
                    
                    statusBadge.innerHTML = '<span class="status-badge ' + badgeClass + '">' + 
                        status + ' ' + (response.statusText || '') + '</span>';
                    
                    // Response info
                    if (response.duration !== undefined) {
                        info.innerText = 'Duration: ' + response.duration + 'ms | Size: ' + formatBytes(response.size || 0);
                    }
                    
                    // Response body
                    try {
                        body.innerText = JSON.stringify(response.data, null, 2);
                    } catch (e) {
                        body.innerText = String(response.data);
                    }
                }
                
                function displayError(error) {
                    const section = document.getElementById('response-section');
                    const body = document.getElementById('response-body');
                    const statusBadge = document.getElementById('status-badge');
                    const info = document.getElementById('response-info');
                    
                    section.style.display = 'block';
                    statusBadge.innerHTML = '<span class="status-badge status-error">Error</span>';
                    info.innerText = '';
                    body.innerHTML = '<div class="error">' + escapeHtml(error) + '</div>';
                }
                
                function clearResponse() {
                    document.getElementById('response-section').style.display = 'none';
                    document.getElementById('response-body').innerText = '';
                    document.getElementById('status-badge').innerHTML = '';
                    document.getElementById('response-info').innerText = '';
                }
                
                function formatBytes(bytes) {
                    if (bytes === 0) return '0 B';
                    const k = 1024;
                    const sizes = ['B', 'KB', 'MB', 'GB'];
                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
                }
                
                function escapeHtml(text) {
                    const div = document.createElement('div');
                    div.textContent = text;
                    return div.innerHTML;
                }

                document.getElementById('send').addEventListener('click', () => {
                    const method = document.getElementById('method').value;
                    const url = document.getElementById('url').value;
                    const bodyText = document.getElementById('body').value;
                    
                    if (!url) {
                        vscode.postMessage({
                            command: 'error',
                            error: 'URL is required'
                        });
                        return;
                    }
                    
                    let body = null;
                    if (bodyText && ['POST', 'PUT', 'PATCH'].includes(method)) {
                        try {
                            body = JSON.parse(bodyText);
                        } catch (e) {
                            displayError('Invalid JSON in request body: ' + e.message);
                            return;
                        }
                    }
                    
                    vscode.postMessage({
                        command: 'sendRequest',
                        data: {
                            method: method,
                            url: url,
                            body: body
                        }
                    });
                });
                
                document.getElementById('clear').addEventListener('click', () => {
                    document.getElementById('url').value = '';
                    document.getElementById('body').value = '';
                    clearResponse();
                });
            </script>
        </body>
        </html>`;
    }

    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    private _getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
