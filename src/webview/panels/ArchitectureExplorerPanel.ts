import * as vscode from 'vscode';
import { ArchitectureModel } from '../../architecture/scanner';
import { ArchitectureDocumentation } from '../../architecture/diagramGenerator';

export class ArchitectureExplorerPanel {
    private static currentPanel: ArchitectureExplorerPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static show(
        extensionUri: vscode.Uri,
        model: ArchitectureModel,
        documentation: ArchitectureDocumentation
    ) {
        if (ArchitectureExplorerPanel.currentPanel) {
            ArchitectureExplorerPanel.currentPanel.update(model, documentation);
            ArchitectureExplorerPanel.currentPanel.reveal();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'bunnyaiArchitectureExplorer',
            'Architecture Explorer',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
                retainContextWhenHidden: true
            }
        );

        ArchitectureExplorerPanel.currentPanel = new ArchitectureExplorerPanel(panel, extensionUri);
        ArchitectureExplorerPanel.currentPanel.update(model, documentation);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'switchDiagram':
                        this.switchDiagram(message.diagramType);
                        break;
                }
            },
            null,
            this._disposables
        );

        this._panel.webview.html = this.getHtml();
    }

    private switchDiagram(diagramType: string) {
        this._panel.webview.postMessage({
            type: 'switchDiagram',
            diagramType
        });
    }

    private reveal() {
        this._panel.reveal(undefined, true);
    }

    private update(model: ArchitectureModel, documentation: ArchitectureDocumentation) {
        this._panel.webview.postMessage({
            type: 'architecture',
            payload: {
                model,
                documentation
            }
        });
    }

    private dispose() {
        ArchitectureExplorerPanel.currentPanel = undefined;
        this._disposables.forEach(d => d.dispose());
    }

    private getHtml(): string {
        const nonce = this.getNonce();
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; img-src ${this._panel.webview.cspSource} https:; style-src ${this._panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' https://cdn.jsdelivr.net; connect-src https://cdn.jsdelivr.net;">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Architecture Explorer</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js" nonce="${nonce}"></script>
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
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 1.5rem;
        }
        .summary-card {
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 4px;
            padding: 16px;
        }
        .summary-card-title {
            font-size: 0.875rem;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
        }
        .summary-card-value {
            font-size: 1.5rem;
            font-weight: 600;
        }
        .diagram-controls {
            display: flex;
            gap: 8px;
            margin-bottom: 16px;
        }
        .button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.875rem;
        }
        .button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .button.active {
            background: var(--vscode-button-activeBackground);
        }
        .diagram-container {
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 4px;
            padding: 16px;
            margin-bottom: 1.5rem;
            overflow-x: auto;
        }
        .narrative {
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 4px;
            padding: 16px;
            margin-bottom: 1.5rem;
            line-height: 1.6;
        }
        .hotspot {
            background: var(--vscode-editorWidget-background);
            border-left: 3px solid var(--vscode-errorForeground);
            padding: 12px;
            margin-bottom: 8px;
        }
        .hotspot-title {
            font-weight: 600;
            color: var(--vscode-errorForeground);
            margin-bottom: 4px;
        }
        .improvement {
            background: var(--vscode-textBlockQuote-background);
            border-left: 3px solid var(--vscode-textLink-foreground);
            padding: 12px;
            margin-bottom: 8px;
        }
        .improvement-title {
            font-weight: 600;
            margin-bottom: 4px;
        }
    </style>
</head>
<body>
    <h1>Architecture Explorer</h1>
    <div id="content">
        <div class="summary" id="summary"></div>
        <div class="narrative" id="narrative"></div>
        <h2>Architecture Diagrams</h2>
        <div class="diagram-controls" id="diagramControls"></div>
        <div class="diagram-container" id="diagramContainer"></div>
        <h2>Hotspots</h2>
        <div id="hotspots"></div>
        <h2>Suggested Improvements</h2>
        <div id="improvements"></div>
    </div>
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        let currentData = null;
        let mermaidInitialized = false;

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'architecture') {
                currentData = message.payload;
                renderArchitecture(currentData);
            } else if (message.type === 'switchDiagram') {
                renderDiagram(message.diagramType);
            }
        });

        function renderArchitecture(data) {
            renderSummary(data.model);
            renderNarrative(data.documentation);
            renderHotspots(data.documentation);
            renderImprovements(data.documentation);
            renderDiagramControls(data.documentation);
            renderDiagram('flowchart');
        }

        function renderSummary(model) {
            const container = document.getElementById('summary');
            container.innerHTML = \`
                <div class="summary-card">
                    <div class="summary-card-title">Project Type</div>
                    <div class="summary-card-value">\${escapeHtml(model.projectType)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-title">Framework</div>
                    <div class="summary-card-value">\${escapeHtml(model.framework || 'None')}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-title">Modules</div>
                    <div class="summary-card-value">\${model.modules.length}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-title">Components</div>
                    <div class="summary-card-value">\${model.components.length}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-title">Dependencies</div>
                    <div class="summary-card-value">\${model.dependencies.length}</div>
                </div>
            \`;
        }

        function renderNarrative(doc) {
            const container = document.getElementById('narrative');
            container.innerHTML = \`<p>\${escapeHtml(doc.narrative)}</p>\`;
        }

        function renderDiagramControls(doc) {
            const container = document.getElementById('diagramControls');
            container.innerHTML = \`
                <button class="button active" onclick="switchDiagram('flowchart')">Flowchart</button>
                <button class="button" onclick="switchDiagram('classDiagram')">Class Diagram</button>
                \${doc.mermaidDiagrams.sequenceDiagram ? '<button class="button" onclick="switchDiagram(\'sequenceDiagram\')">Sequence Diagram</button>' : ''}
            \`;
        }

        function switchDiagram(type) {
            // Update button states
            document.querySelectorAll('.diagram-controls .button').forEach(btn => {
                btn.classList.remove('active');
                if (btn.textContent.trim().toLowerCase().includes(type.toLowerCase())) {
                    btn.classList.add('active');
                }
            });
            
            renderDiagram(type);
        }

        function renderDiagram(type) {
            if (!currentData) return;

            const container = document.getElementById('diagramContainer');
            const diagram = currentData.documentation.mermaidDiagrams[type];
            
            if (!diagram) {
                container.innerHTML = '<p>Diagram not available</p>';
                return;
            }

            // Initialize Mermaid if not done
            if (!mermaidInitialized) {
                mermaid.initialize({ 
                    startOnLoad: false, 
                    theme: 'dark',
                    securityLevel: 'loose'
                });
                mermaidInitialized = true;
            }

            // Render diagram
            const diagramId = 'diagram-' + type + '-' + Date.now();
            mermaid.render(diagramId, diagram).then((result) => {
                container.innerHTML = result.svg;
            }).catch((error) => {
                container.innerHTML = '<p>Error rendering diagram: ' + escapeHtml(error.message) + '</p>';
            });
        }

        function renderHotspots(doc) {
            const container = document.getElementById('hotspots');
            if (doc.hotspots.length === 0) {
                container.innerHTML = '<p>No hotspots identified.</p>';
                return;
            }
            container.innerHTML = doc.hotspots.map(h => \`
                <div class="hotspot">
                    <div class="hotspot-title">\${escapeHtml(h.module)}</div>
                    <div>\${escapeHtml(h.reason)}</div>
                </div>
            \`).join('');
        }

        function renderImprovements(doc) {
            const container = document.getElementById('improvements');
            container.innerHTML = doc.improvements.map(imp => \`
                <div class="improvement">
                    <div class="improvement-title">• \${escapeHtml(imp)}</div>
                </div>
            \`).join('');
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

