import * as vscode from 'vscode';
import { RuleEvaluationResult, RuleViolation } from '../../architecture/ruleEngine';
import { RefactorPlan } from '../../refactor/refactorExecutor';
import { ArchitectureRuleFixer } from '../../architecture/ruleFixer';

export class ArchitectureRulesPanel {
    private static currentPanel: ArchitectureRulesPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private currentResult: RuleEvaluationResult | undefined;
    private fixer: ArchitectureRuleFixer | undefined;
    private fixPlan: RefactorPlan | undefined;

    public static show(extensionUri: vscode.Uri, result: RuleEvaluationResult) {
        if (ArchitectureRulesPanel.currentPanel) {
            ArchitectureRulesPanel.currentPanel.update(result);
            ArchitectureRulesPanel.currentPanel.reveal();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'bunnyaiArchitectureRules',
            'BunnyAI Architecture Rules',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
                retainContextWhenHidden: true
            }
        );

        ArchitectureRulesPanel.currentPanel = new ArchitectureRulesPanel(panel, extensionUri);
        ArchitectureRulesPanel.currentPanel.update(result);
    }

    private constructor(panel: vscode.WebviewPanel, private readonly extensionUri: vscode.Uri) {
        this.panel = panel;
        this.panel.webview.html = this.getHtml();
        this.panel.onDidDispose(() => {
            ArchitectureRulesPanel.currentPanel = undefined;
        });

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'generateFixPlan':
                    await this.handleGenerateFixPlan();
                    break;
                case 'applyFixes':
                    await this.handleApplyFixes();
                    break;
                case 'showDiff':
                    await this.handleShowDiff(message.file, message.editIndex);
                    break;
            }
        });
    }

    private update(result: RuleEvaluationResult) {
        this.currentResult = result;
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            this.fixer = new ArchitectureRuleFixer(workspaceFolder.uri.fsPath);
        }
        this.fixPlan = undefined;
        this.panel.webview.html = this.getHtml();
    }

    private reveal() {
        this.panel.reveal();
    }

    private async handleGenerateFixPlan() {
        if (!this.currentResult || !this.fixer) {
            vscode.window.showErrorMessage('No rule evaluation result available');
            return;
        }

        try {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Generating Fix Plan',
                    cancellable: false
                },
                async (progress) => {
                    progress.report({ increment: 0, message: 'Analyzing violations...' });
                    
                    const violations = this.currentResult!.violations.filter(v => v.suggestedFix);
                    this.fixPlan = await this.fixer!.generateFixPlan(violations);
                    
                    progress.report({ increment: 100, message: 'Complete!' });
                    
                    // Update panel
                    this.panel.webview.html = this.getHtml();
                    
                    vscode.window.showInformationMessage(
                        `Fix plan generated: ${this.fixPlan.edits?.length || 0} edits, ${this.fixPlan.moves?.length || 0} moves, ${this.fixPlan.creates?.length || 0} creates`
                    );
                }
            );
        } catch (error) {
            vscode.window.showErrorMessage(`Error generating fix plan: ${error}`);
        }
    }

    private async handleApplyFixes() {
        if (!this.fixPlan || !this.fixer) {
            vscode.window.showErrorMessage('No fix plan available. Generate a fix plan first.');
            return;
        }

        const confirmed = await vscode.window.showWarningMessage(
            'Are you sure you want to apply these fixes? This will modify files in your workspace.',
            { modal: true },
            'Apply Fixes'
        );

        if (confirmed !== 'Apply Fixes') {
            return;
        }

        try {
            const result = await this.fixer.applyFixes(this.fixPlan);
            
            if (result.success) {
                vscode.window.showInformationMessage(
                    `Successfully applied ${result.applied} fix(es)!`
                );
                
                // Refresh panel
                if (this.currentResult) {
                    this.update(this.currentResult);
                }
            } else {
                vscode.window.showErrorMessage(
                    `Failed to apply fixes: ${result.errors.join(', ')}`
                );
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error applying fixes: ${error}`);
        }
    }

    private async handleShowDiff(file: string, editIndex: number) {
        if (!this.fixPlan?.edits) {
            return;
        }

        const edit = this.fixPlan.edits[editIndex];
        if (!edit || edit.file !== file) {
            return;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, file);
        
        try {
            // Create temporary file with new content
            const tempUri = vscode.Uri.joinPath(workspaceFolder.uri, `.${file}.fix.tmp`);
            await vscode.workspace.fs.writeFile(tempUri, Buffer.from(edit.newText || '', 'utf-8'));

            // Show diff
            await vscode.commands.executeCommand('vscode.diff', fileUri, tempUri, `${file} (Fix Preview)`);

            // Clean up temp file after a delay
            setTimeout(async () => {
                try {
                    await vscode.workspace.fs.delete(tempUri);
                } catch {
                    // Ignore cleanup errors
                }
            }, 60000);
        } catch (error) {
            vscode.window.showErrorMessage(`Error showing diff: ${error}`);
        }
    }

    private getHtml(): string {
        const result = this.currentResult;
        if (!result) {
            return this.getEmptyHtml();
        }

        const violations = result.violations;
        const summary = result.summary;

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BunnyAI Architecture Rules</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        .header {
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        .header h1 {
            margin: 0 0 10px 0;
            color: var(--vscode-textLink-foreground);
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin-bottom: 30px;
        }
        .summary-card {
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 3px solid var(--vscode-textLink-foreground);
            padding: 15px;
            border-radius: 3px;
        }
        .summary-card.error {
            border-left-color: var(--vscode-errorForeground);
        }
        .summary-card.warning {
            border-left-color: var(--vscode-testing-iconQueued);
        }
        .summary-card.info {
            border-left-color: var(--vscode-textLink-foreground);
        }
        .summary-card h3 {
            margin: 0 0 5px 0;
            font-size: 14px;
            opacity: 0.8;
        }
        .summary-card .value {
            font-size: 24px;
            font-weight: bold;
        }
        .section {
            margin-bottom: 30px;
        }
        .section h2 {
            color: var(--vscode-textLink-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 5px;
            margin-bottom: 15px;
        }
        .violation {
            padding: 10px;
            margin: 8px 0;
            background-color: var(--vscode-list-inactiveSelectionBackground);
            border-radius: 3px;
            border-left: 3px solid var(--vscode-panel-border);
        }
        .violation.error {
            border-left-color: var(--vscode-errorForeground);
        }
        .violation.warning {
            border-left-color: var(--vscode-testing-iconQueued);
        }
        .violation.info {
            border-left-color: var(--vscode-textLink-foreground);
        }
        .violation-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 5px;
        }
        .violation-rule {
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
        }
        .violation-severity {
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .violation-severity.error {
            background-color: var(--vscode-errorForeground);
            color: white;
        }
        .violation-severity.warning {
            background-color: var(--vscode-testing-iconQueued);
            color: white;
        }
        .violation-severity.info {
            background-color: var(--vscode-textLink-foreground);
            color: white;
        }
        .violation-file {
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin: 5px 0;
        }
        .violation-message {
            margin: 5px 0;
        }
        .violation-fix {
            margin-top: 8px;
            padding: 8px;
            background-color: var(--vscode-textBlockQuote-background);
            border-radius: 3px;
            font-size: 12px;
        }
        .violation-fix strong {
            color: var(--vscode-textLink-foreground);
        }
        .button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 20px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 14px;
            margin: 5px;
        }
        .button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .button-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .button-secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .actions {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid var(--vscode-panel-border);
        }
        .fix-plan {
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 3px solid var(--vscode-textLink-foreground);
            padding: 15px;
            margin: 15px 0;
            border-radius: 3px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Architecture Rules Evaluation</h1>
    </div>

    <div class="summary">
        <div class="summary-card">
            <h3>Total Violations</h3>
            <div class="value">${summary.total}</div>
        </div>
        <div class="summary-card error">
            <h3>Errors</h3>
            <div class="value">${summary.errors}</div>
        </div>
        <div class="summary-card warning">
            <h3>Warnings</h3>
            <div class="value">${summary.warnings}</div>
        </div>
        <div class="summary-card info">
            <h3>Info</h3>
            <div class="value">${summary.info}</div>
        </div>
    </div>

    <div class="section">
        <h2>Violations (${violations.length})</h2>
        ${violations.length === 0 ? `
        <div class="violation info">
            <div class="violation-message">✅ No violations found! Your code follows all architecture rules.</div>
        </div>
        ` : violations.map((v, idx) => `
        <div class="violation ${v.severity}">
            <div class="violation-header">
                <span class="violation-rule">${v.rule}</span>
                <span class="violation-severity ${v.severity}">${v.severity}</span>
            </div>
            ${v.file ? `<div class="violation-file">📄 ${v.file}${v.line ? `:${v.line}` : ''}</div>` : ''}
            <div class="violation-message">${this.escapeHtml(v.message)}</div>
            ${v.suggestedFix ? `
            <div class="violation-fix">
                <strong>Suggested Fix:</strong> ${this.escapeHtml(v.suggestedFix.description)}
                ${v.suggestedFix.newPath ? `<br><code>${v.suggestedFix.oldPath} → ${v.suggestedFix.newPath}</code>` : ''}
            </div>
            ` : ''}
        </div>
        `).join('')}
    </div>

    ${this.fixPlan ? `
    <div class="section">
        <h2>Fix Plan</h2>
        <div class="fix-plan">
            <strong>Summary:</strong> ${this.fixPlan.summary || 'No summary'}
            <br><br>
            <strong>Edits:</strong> ${this.fixPlan.edits?.length || 0}
            <br>
            <strong>Moves:</strong> ${this.fixPlan.moves?.length || 0}
            <br>
            <strong>Creates:</strong> ${this.fixPlan.creates?.length || 0}
            ${this.fixPlan.edits && this.fixPlan.edits.length > 0 ? `
            <h3>Files to Edit</h3>
            <ul>
                ${this.fixPlan.edits.slice(0, 10).map((edit, idx) => `
                    <li>
                        ${edit.file}
                        <button class="button button-secondary" onclick="showDiff('${edit.file}', ${idx})">Show Diff</button>
                    </li>
                `).join('')}
                ${this.fixPlan.edits.length > 10 ? `<li><em>... and ${this.fixPlan.edits.length - 10} more</em></li>` : ''}
            </ul>
            ` : ''}
        </div>
    </div>
    ` : ''}

    <div class="actions">
        ${violations.filter(v => v.suggestedFix).length > 0 ? `
        <button class="button" onclick="generateFixPlan()" ${this.fixPlan ? 'disabled' : ''}>
            ${this.fixPlan ? 'Fix Plan Generated' : 'Generate Fix Plan'}
        </button>
        ` : ''}
        ${this.fixPlan ? `
        <button class="button" onclick="applyFixes()">
            Apply Fixes
        </button>
        ` : ''}
        <p><em>⚠️ Always review the fix plan before applying. Changes can be undone using VS Code's undo feature.</em></p>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        function generateFixPlan() {
            vscode.postMessage({
                command: 'generateFixPlan'
            });
        }
        
        function applyFixes() {
            vscode.postMessage({
                command: 'applyFixes'
            });
        }
        
        function showDiff(file, editIndex) {
            vscode.postMessage({
                command: 'showDiff',
                file: file,
                editIndex: editIndex
            });
        }
    </script>
</body>
</html>`;
    }

    private getEmptyHtml(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BunnyAI Architecture Rules</title>
</head>
<body>
    <h1>No rule evaluation data available</h1>
</body>
</html>`;
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

