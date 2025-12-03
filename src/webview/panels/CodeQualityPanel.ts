import * as vscode from 'vscode';
import { FileQualityReport } from '../../analysis/codeQualityAnalyzer';

export class CodeQualityPanel {
    private static currentPanel: CodeQualityPanel | undefined;

    public static show(extensionUri: vscode.Uri, report: FileQualityReport) {
        if (CodeQualityPanel.currentPanel) {
            CodeQualityPanel.currentPanel.update(report);
            CodeQualityPanel.currentPanel.reveal();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'bunnyaiCodeQuality',
            'Code Quality Report',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
                retainContextWhenHidden: true
            }
        );

        CodeQualityPanel.currentPanel = new CodeQualityPanel(panel);
        CodeQualityPanel.currentPanel.update(report);
    }

    private constructor(private readonly panel: vscode.WebviewPanel) {
        this.panel.webview.html = this.getHtml();
        this.panel.onDidDispose(() => {
            CodeQualityPanel.currentPanel = undefined;
        });
    }

    private reveal() {
        this.panel.reveal(undefined, true);
    }

    private update(report: FileQualityReport) {
        this.panel.webview.postMessage({
            type: 'report',
            payload: report
        });
    }

    private getHtml(): string {
        const nonce = this.getNonce();
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; img-src ${this.panel.webview.cspSource} https:; style-src ${this.panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Quality Report</title>
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
            font-size: 1.25rem;
            margin-bottom: 0.5rem;
        }
        .summary {
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
            margin-bottom: 1rem;
        }
        .summary-card {
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 6px;
            padding: 12px 16px;
            min-width: 140px;
        }
        .summary-card h3 {
            margin: 0;
            font-size: 0.85rem;
            color: var(--vscode-descriptionForeground);
        }
        .summary-card p {
            margin: 6px 0 0 0;
            font-size: 1.1rem;
            font-weight: bold;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            padding: 8px;
            text-align: left;
            border-bottom: 1px solid var(--vscode-editor-foreground, rgba(255,255,255,0.1));
        }
        th {
            color: var(--vscode-descriptionForeground);
            font-weight: 600;
        }
        tr:nth-child(even) {
            background: color-mix(in srgb, var(--vscode-editor-background) 90%, var(--vscode-editor-foreground) 10%);
        }
        .grade-chip {
            display: inline-block;
            min-width: 24px;
            text-align: center;
            padding: 2px 8px;
            border-radius: 12px;
            font-weight: bold;
        }
        .grade-A { background: #2ea043; color: #fff; }
        .grade-B { background: #3fb950; color: #fff; }
        .grade-C { background: #a98f00; color: #fff; }
        .grade-D { background: #d29922; color: #fff; }
        .grade-E { background: #da3633; color: #fff; }
        .grade-F { background: #b62324; color: #fff; }
        .empty-state {
            padding: 24px;
            border: 1px dashed var(--vscode-descriptionForeground);
            border-radius: 6px;
            text-align: center;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <h1>Code Quality Report</h1>
    <div id="meta" class="summary"></div>
    <div id="table-container"></div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        function renderReport(report) {
            const meta = document.getElementById('meta');
            const tableContainer = document.getElementById('table-container');

            if (!report || !report.functions || report.functions.length === 0) {
                meta.innerHTML = '';
                tableContainer.innerHTML = '<div class="empty-state">No functions detected in this file.</div>';
                return;
            }

            const worst = report.functions.reduce((prev, curr) => {
                const order = ['A','B','C','D','E','F'];
                return order.indexOf(curr.maintainability) > order.indexOf(prev.maintainability) ? curr : prev;
            }, report.functions[0]);

            const summaryCards = [
                '<div class="summary-card"><h3>File</h3><p>' + report.filePath + '</p></div>',
                '<div class="summary-card"><h3>Functions</h3><p>' + report.functions.length + '</p></div>',
                '<div class="summary-card"><h3>Average Cyclomatic</h3><p>' + report.summary.avgCyclomatic + '</p></div>',
                '<div class="summary-card"><h3>Max Cyclomatic</h3><p>' + report.summary.maxCyclomatic + '</p></div>',
                '<div class="summary-card"><h3>Worst Function</h3><p>' + (worst?.name || '-') + '</p></div>',
                '<div class="summary-card"><h3>Worst Grade</h3><p><span class="grade-chip grade-' +
                    (worst?.maintainability || 'A') +
                    '">' +
                    (worst?.maintainability || 'A') +
                    '</span></p></div>'
            ].join('');
            meta.innerHTML = summaryCards;

            const rows = report.functions
                .map((func) => {
                    return (
                        '<tr>' +
                        '<td>' + func.name + '</td>' +
                        '<td>' + func.startLine + ' - ' + func.endLine + '</td>' +
                        '<td>' + func.cyclomatic + '</td>' +
                        '<td>' + func.loc + '</td>' +
                        '<td>' + func.nestingDepth + '</td>' +
                        '<td><span class="grade-chip grade-' + func.maintainability + '">' + func.maintainability + '</span></td>' +
                        '</tr>'
                    );
                })
                .join('');

            tableContainer.innerHTML =
                '<table>' +
                '<thead>' +
                '<tr>' +
                '<th>Function</th>' +
                '<th>Lines</th>' +
                '<th>Cyclomatic</th>' +
                '<th>LOC</th>' +
                '<th>Nesting</th>' +
                '<th>Grade</th>' +
                '</tr>' +
                '</thead>' +
                '<tbody>' +
                rows +
                '</tbody>' +
                '</table>';
        }

        window.addEventListener('message', event => {
            if (event.data?.type === 'report') {
                renderReport(event.data.payload);
            }
        });
    </script>
</body>
</html>`;
    }

    private getNonce(): string {
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let text = '';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}


