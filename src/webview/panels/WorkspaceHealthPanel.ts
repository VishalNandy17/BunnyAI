import * as vscode from 'vscode';
import { WorkspaceHealthReport } from '../../analysis/workspaceAnalyzer';

export class WorkspaceHealthPanel {
    private static currentPanel: WorkspaceHealthPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static show(extensionUri: vscode.Uri, report: WorkspaceHealthReport) {
        if (WorkspaceHealthPanel.currentPanel) {
            WorkspaceHealthPanel.currentPanel.update(report);
            WorkspaceHealthPanel.currentPanel.reveal();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'bunnyaiWorkspaceHealth',
            'Workspace Code Health',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
                retainContextWhenHidden: true
            }
        );

        WorkspaceHealthPanel.currentPanel = new WorkspaceHealthPanel(panel, extensionUri);
        WorkspaceHealthPanel.currentPanel.update(report);
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

    private update(report: WorkspaceHealthReport) {
        this._panel.webview.postMessage({
            type: 'report',
            payload: report
        });
    }

    private dispose() {
        WorkspaceHealthPanel.currentPanel = undefined;
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
    <title>Workspace Code Health</title>
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
            color: var(--vscode-editor-foreground);
        }
        .summary-card-value.high {
            color: var(--vscode-errorForeground);
        }
        .summary-card-value.medium {
            color: var(--vscode-textBlockQuote-border);
        }
        .summary-card-value.low {
            color: var(--vscode-textLink-foreground);
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 1.5rem;
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-editorWidget-border);
        }
        th {
            background: var(--vscode-list-hoverBackground);
            padding: 8px 12px;
            text-align: left;
            font-weight: 600;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        td {
            padding: 8px 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        tr:hover {
            background: var(--vscode-list-hoverBackground);
        }
        .clickable {
            cursor: pointer;
            color: var(--vscode-textLink-foreground);
            text-decoration: underline;
        }
        .clickable:hover {
            color: var(--vscode-textLink-activeForeground);
        }
        .severity-high {
            color: var(--vscode-errorForeground);
            font-weight: 600;
        }
        .severity-medium {
            color: var(--vscode-textBlockQuote-border);
        }
        .severity-low {
            color: var(--vscode-textLink-foreground);
        }
        .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
        }
        .badge-high {
            background: var(--vscode-errorForeground);
            color: white;
        }
        .badge-medium {
            background: var(--vscode-textBlockQuote-border);
            color: white;
        }
        .badge-low {
            background: var(--vscode-textLink-foreground);
            color: white;
        }
        .badge-complexity {
            background: var(--vscode-textBlockQuote-border);
            color: white;
        }
    </style>
</head>
<body>
    <h1>Workspace Code Health Report</h1>
    <div id="content">
        <div class="summary" id="summary"></div>
        <h2>Worst Offenders</h2>
        <table id="worstOffenders">
            <thead>
                <tr>
                    <th>File</th>
                    <th>Avg Complexity</th>
                    <th>Max Complexity</th>
                    <th>Functions</th>
                    <th>Security Issues</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
        <h2>Top 10 Most Complex Functions</h2>
        <table id="complexFunctions">
            <thead>
                <tr>
                    <th>Function</th>
                    <th>File</th>
                    <th>Line</th>
                    <th>Complexity</th>
                    <th>Maintainability</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
        <h2>Security Issues</h2>
        <table id="securityIssues">
            <thead>
                <tr>
                    <th>Severity</th>
                    <th>File</th>
                    <th>Line</th>
                    <th>Issue</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    </div>
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        let currentReport = null;

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'report') {
                currentReport = message.payload;
                renderReport(currentReport);
            }
        });

        function renderReport(report) {
            renderSummary(report.summary);
            renderWorstOffenders(report.worstOffenders);
            renderComplexFunctions(report.topComplexFunctions);
            renderSecurityIssues(report.securityIssues);
        }

        function renderSummary(summary) {
            const container = document.getElementById('summary');
            container.innerHTML = \`
                <div class="summary-card">
                    <div class="summary-card-title">Files Scanned</div>
                    <div class="summary-card-value">\${summary.filesScanned} / \${summary.totalFiles}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-title">Average Complexity</div>
                    <div class="summary-card-value \${summary.averageCyclomaticComplexity > 10 ? 'high' : summary.averageCyclomaticComplexity > 5 ? 'medium' : 'low'}">\${summary.averageCyclomaticComplexity.toFixed(2)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-title">Max Complexity</div>
                    <div class="summary-card-value \${summary.maxCyclomaticComplexity > 20 ? 'high' : summary.maxCyclomaticComplexity > 10 ? 'medium' : 'low'}">\${summary.maxCyclomaticComplexity}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-title">Security Issues</div>
                    <div class="summary-card-value \${summary.totalSecurityIssues > 0 ? 'high' : 'low'}">\${summary.totalSecurityIssues}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-title">High Severity</div>
                    <div class="summary-card-value high">\${summary.securityIssuesBySeverity.high}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-title">Medium Severity</div>
                    <div class="summary-card-value medium">\${summary.securityIssuesBySeverity.medium}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-title">Low Severity</div>
                    <div class="summary-card-value low">\${summary.securityIssuesBySeverity.low}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-card-title">Files with Errors</div>
                    <div class="summary-card-value \${summary.filesWithErrors > 0 ? 'high' : 'low'}">\${summary.filesWithErrors}</div>
                </div>
            \`;
        }

        function renderWorstOffenders(offenders) {
            const tbody = document.querySelector('#worstOffenders tbody');
            tbody.innerHTML = offenders.map(item => \`
                <tr>
                    <td><span class="clickable" onclick="openFile('\${item.filePath}')">\${item.relativePath}</span></td>
                    <td><span class="badge badge-complexity">\${item.averageComplexity.toFixed(2)}</span></td>
                    <td><span class="badge badge-complexity">\${item.maxComplexity}</span></td>
                    <td>\${item.functionCount}</td>
                    <td>\${item.securityIssues > 0 ? '<span class="badge badge-high">' + item.securityIssues + '</span>' : '0'}</td>
                </tr>
            \`).join('');
        }

        function renderComplexFunctions(functions) {
            const tbody = document.querySelector('#complexFunctions tbody');
            tbody.innerHTML = functions.map(item => \`
                <tr>
                    <td><strong>\${escapeHtml(item.functionName)}</strong></td>
                    <td><span class="clickable" onclick="openFile('\${item.filePath}', \${item.line})">\${item.relativePath}</span></td>
                    <td>\${item.line}</td>
                    <td><span class="badge badge-complexity">\${item.complexity}</span></td>
                    <td><span class="badge \${getMaintainabilityClass(item.maintainability)}">\${item.maintainability}</span></td>
                </tr>
            \`).join('');
        }

        function renderSecurityIssues(issues) {
            const tbody = document.querySelector('#securityIssues tbody');
            if (issues.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem;">No security issues found! 🎉</td></tr>';
                return;
            }
            tbody.innerHTML = issues.map(item => \`
                <tr>
                    <td><span class="badge badge-\${item.issue.severity} severity-\${item.issue.severity}">\${item.issue.severity.toUpperCase()}</span></td>
                    <td><span class="clickable" onclick="openFile('\${item.filePath}', \${item.issue.line})">\${item.relativePath}</span></td>
                    <td>\${item.issue.line}</td>
                    <td>\${escapeHtml(item.issue.message)}</td>
                </tr>
            \`).join('');
        }

        function openFile(filePath, line) {
            vscode.postMessage({
                command: 'openFile',
                filePath: filePath,
                line: line
            });
        }

        function getMaintainabilityClass(grade) {
            if (grade === 'A' || grade === 'B') return 'badge-low';
            if (grade === 'C' || grade === 'D') return 'badge-medium';
            return 'badge-high';
        }

        function escapeHtml(text) {
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

