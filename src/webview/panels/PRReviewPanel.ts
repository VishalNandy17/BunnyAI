import * as vscode from 'vscode';
import { PRReviewResult, PRReviewFinding } from '../../ai/AIPRReviewer';
import { GitHubAPI } from '../../integrations/github';

export class PRReviewPanel {
    private static currentPanel: PRReviewPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _reviewResult: PRReviewResult | undefined;
    private _githubAPI: GitHubAPI | undefined;
    private _owner: string = '';
    private _repo: string = '';
    private _prNumber: number = 0;

    public static show(
        extensionUri: vscode.Uri,
        reviewResult: PRReviewResult,
        githubAPI: GitHubAPI,
        owner: string,
        repo: string,
        prNumber: number
    ) {
        if (PRReviewPanel.currentPanel) {
            PRReviewPanel.currentPanel.update(reviewResult, githubAPI, owner, repo, prNumber);
            PRReviewPanel.currentPanel.reveal();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'bunnyaiPRReview',
            'BunnyAI PR Review',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
                retainContextWhenHidden: true
            }
        );

        PRReviewPanel.currentPanel = new PRReviewPanel(panel, extensionUri);
        PRReviewPanel.currentPanel.update(reviewResult, githubAPI, owner, repo, prNumber);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'postComment':
                        await this.postCommentToPR(message.body, message.path, message.line);
                        break;
                    case 'postAllComments':
                        await this.postAllCommentsToPR();
                        break;
                }
            },
            null,
            this._disposables
        );

        this._panel.webview.html = this.getHtml();
    }

    private async postCommentToPR(body: string, path?: string, line?: number): Promise<void> {
        if (!this._githubAPI || !this._owner || !this._repo || !this._prNumber) {
            vscode.window.showErrorMessage('GitHub API not configured');
            return;
        }

        try {
            if (path && line) {
                await this._githubAPI.createPRReviewComment(
                    this._owner,
                    this._repo,
                    this._prNumber,
                    body,
                    path,
                    line
                );
            } else {
                await this._githubAPI.createPRComment(
                    this._owner,
                    this._repo,
                    this._prNumber,
                    body
                );
            }
            vscode.window.showInformationMessage('Comment posted to PR successfully!');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to post comment: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async postAllCommentsToPR(): Promise<void> {
        if (!this._reviewResult || !this._githubAPI) {
            return;
        }

        const confirmed = await vscode.window.showWarningMessage(
            `Post all ${this._reviewResult.totalFindings} findings as comments to the PR?`,
            'Yes',
            'No'
        );

        if (confirmed !== 'Yes') {
            return;
        }

        try {
            for (const finding of this._reviewResult.findings) {
                if (finding.line && finding.suggestion) {
                    await this.postCommentToPR(
                        `**${finding.category.toUpperCase()}**: ${finding.message}\n\n${finding.suggestion}`,
                        finding.file,
                        finding.line
                    );
                    // Rate limit: wait 1 second between comments
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            vscode.window.showInformationMessage('All comments posted successfully!');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to post some comments: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private reveal() {
        this._panel.reveal(undefined, true);
    }

    private update(
        reviewResult: PRReviewResult,
        githubAPI: GitHubAPI,
        owner: string,
        repo: string,
        prNumber: number
    ) {
        this._reviewResult = reviewResult;
        this._githubAPI = githubAPI;
        this._owner = owner;
        this._repo = repo;
        this._prNumber = prNumber;

        this._panel.webview.postMessage({
            type: 'review',
            payload: reviewResult,
            prInfo: { owner, repo, prNumber }
        });
    }

    private dispose() {
        PRReviewPanel.currentPanel = undefined;
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
    <title>PR Review</title>
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
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 4px;
            padding: 16px;
            margin-bottom: 1.5rem;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 12px;
            margin-top: 1rem;
        }
        .stat-card {
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 4px;
            padding: 12px;
            text-align: center;
        }
        .stat-value {
            font-size: 1.5rem;
            font-weight: 600;
        }
        .stat-label {
            font-size: 0.875rem;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }
        .finding {
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 4px;
            padding: 12px;
            margin-bottom: 12px;
        }
        .finding-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        .finding-file {
            font-weight: 600;
            color: var(--vscode-textLink-foreground);
        }
        .finding-meta {
            display: flex;
            gap: 8px;
            align-items: center;
        }
        .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
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
        .badge-category {
            background: var(--vscode-list-hoverBackground);
            color: var(--vscode-editor-foreground);
        }
        .finding-message {
            margin: 8px 0;
        }
        .finding-suggestion {
            background: var(--vscode-textBlockQuote-background);
            border-left: 3px solid var(--vscode-textLink-foreground);
            padding: 8px 12px;
            margin-top: 8px;
            font-style: italic;
        }
        .code-snippet {
            background: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 8px;
            margin-top: 8px;
            font-family: var(--vscode-editor-font-family);
            font-size: 0.875rem;
            overflow-x: auto;
        }
        .button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.875rem;
            margin-top: 8px;
        }
        .button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .button-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .button-secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        .file-group {
            margin-bottom: 2rem;
        }
        .file-header {
            font-size: 1.1rem;
            font-weight: 600;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
    </style>
</head>
<body>
    <h1>Pull Request Review</h1>
    <div id="content">
        <div class="summary" id="summary"></div>
        <div id="findings"></div>
    </div>
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        let currentReview = null;

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'review') {
                currentReview = message.payload;
                renderReview(currentReview);
            }
        });

        function renderReview(review) {
            renderSummary(review);
            renderFindings(review);
        }

        function renderSummary(review) {
            const container = document.getElementById('summary');
            container.innerHTML = \`
                <h2>PR Summary</h2>
                <p>\${escapeHtml(review.summary)}</p>
                <div class="stats">
                    <div class="stat-card">
                        <div class="stat-value">\${review.filesReviewed}</div>
                        <div class="stat-label">Files Reviewed</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">\${review.totalFindings}</div>
                        <div class="stat-label">Total Findings</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">\${review.findingsByCategory.security}</div>
                        <div class="stat-label">Security</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">\${review.findingsByCategory['code-smell']}</div>
                        <div class="stat-label">Code Smells</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">\${review.findingsByCategory.architecture}</div>
                        <div class="stat-label">Architecture</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">\${review.findingsByCategory['test-coverage']}</div>
                        <div class="stat-label">Test Coverage</div>
                    </div>
                </div>
                <button class="button button-secondary" onclick="postAllComments()" style="margin-top: 16px;">
                    Post All Comments to PR
                </button>
            \`;
        }

        function renderFindings(review) {
            const container = document.getElementById('findings');
            
            // Group findings by file
            const fileGroups = {};
            review.findings.forEach(finding => {
                if (!fileGroups[finding.file]) {
                    fileGroups[finding.file] = [];
                }
                fileGroups[finding.file].push(finding);
            });

            container.innerHTML = Object.keys(fileGroups).map(file => \`
                <div class="file-group">
                    <div class="file-header">\${escapeHtml(file)}</div>
                    \${fileGroups[file].map(f => renderFinding(f)).join('')}
                </div>
            \`).join('');
        }

        function renderFinding(finding) {
            const severityClass = \`badge-\${finding.severity}\`;
            return \`
                <div class="finding">
                    <div class="finding-header">
                        <div class="finding-file">\${escapeHtml(finding.file)}\${finding.line ? ':' + finding.line : ''}</div>
                        <div class="finding-meta">
                            <span class="badge \${severityClass}">\${finding.severity.toUpperCase()}</span>
                            <span class="badge badge-category">\${finding.category}</span>
                        </div>
                    </div>
                    <div class="finding-message">\${escapeHtml(finding.message)}</div>
                    \${finding.suggestion ? \`
                        <div class="finding-suggestion">
                            <strong>Suggestion:</strong> \${escapeHtml(finding.suggestion)}
                        </div>
                    \` : ''}
                    \${finding.codeSnippet ? \`
                        <div class="code-snippet">\${escapeHtml(finding.codeSnippet)}</div>
                    \` : ''}
                    \${finding.line ? \`
                        <button class="button" onclick="postComment('\${finding.file}', \${finding.line})">
                            Post Comment to PR
                        </button>
                    \` : ''}
                </div>
            \`;
        }

        function postComment(file, line) {
            const finding = currentReview.findings.find(f => f.file === file && f.line === line);
            if (!finding) return;
            
            const body = \`**\${finding.category.toUpperCase()}**: \${finding.message}\${finding.suggestion ? '\\n\\n' + finding.suggestion : ''}\`;
            vscode.postMessage({
                command: 'postComment',
                body: body,
                path: file,
                line: line
            });
        }

        function postAllComments() {
            vscode.postMessage({
                command: 'postAllComments'
            });
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text || '';
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

