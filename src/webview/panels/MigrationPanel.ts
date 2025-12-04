import * as vscode from 'vscode';
import { MigrationResult } from '../../migrations/types';
import { RefactorPlan, RefactorExecutor } from '../../refactor/refactorExecutor';

export class MigrationPanel {
    private static currentPanel: MigrationPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private currentResult: MigrationResult | undefined;
    private executor: RefactorExecutor | undefined;

    public static show(extensionUri: vscode.Uri, result: MigrationResult) {
        if (MigrationPanel.currentPanel) {
            MigrationPanel.currentPanel.update(result);
            MigrationPanel.currentPanel.reveal();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'bunnyaiMigration',
            'BunnyAI Migration Engine',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
                retainContextWhenHidden: true
            }
        );

        MigrationPanel.currentPanel = new MigrationPanel(panel, extensionUri);
        MigrationPanel.currentPanel.update(result);
    }

    private constructor(panel: vscode.WebviewPanel, private readonly extensionUri: vscode.Uri) {
        this.panel = panel;
        this.panel.webview.html = this.getHtml();
        this.panel.onDidDispose(() => {
            MigrationPanel.currentPanel = undefined;
        });

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'applyMigration':
                    await this.handleApplyMigration();
                    break;
                case 'showDiff':
                    await this.handleShowDiff(message.file, message.editIndex);
                    break;
            }
        });
    }

    private update(result: MigrationResult) {
        this.currentResult = result;
        if (result.refactorPlan) {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                this.executor = new RefactorExecutor(workspaceFolder.uri.fsPath);
            }
        }
        this.panel.webview.html = this.getHtml();
    }

    private reveal() {
        this.panel.reveal();
    }

    private async handleApplyMigration() {
        if (!this.currentResult?.refactorPlan || !this.executor) {
            vscode.window.showErrorMessage('No migration plan available to apply');
            return;
        }

        const confirmed = await vscode.window.showWarningMessage(
            'Are you sure you want to apply this migration? This will modify files in your workspace.',
            { modal: true },
            'Apply Migration'
        );

        if (confirmed !== 'Apply Migration') {
            return;
        }

        try {
            const validation = await this.executor.validatePlan(this.currentResult.refactorPlan);
            
            if (!validation.valid) {
                const errorMsg = `Migration validation failed:\n${validation.errors.join('\n')}`;
                vscode.window.showErrorMessage(errorMsg);
                return;
            }

            if (validation.warnings.length > 0) {
                const proceed = await vscode.window.showWarningMessage(
                    `Migration has warnings:\n${validation.warnings.join('\n')}\n\nProceed anyway?`,
                    { modal: true },
                    'Proceed'
                );
                if (proceed !== 'Proceed') {
                    return;
                }
            }

            await this.executor.executePlan(this.currentResult.refactorPlan);
            vscode.window.showInformationMessage('Migration applied successfully!');
            
            // Refresh the panel
            if (this.currentResult) {
                this.update(this.currentResult);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error applying migration: ${error}`);
        }
    }

    private async handleShowDiff(file: string, editIndex: number) {
        if (!this.currentResult?.refactorPlan) {
            return;
        }

        const edit = this.currentResult.refactorPlan.edits?.[editIndex];
        if (!edit || edit.file !== file) {
            return;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, file);
        
        try {
            // Read current file content (not used but kept for potential future use)
            // const currentContent = await vscode.workspace.fs.readFile(fileUri).then(
            //     bytes => Buffer.from(bytes).toString('utf-8')
            // ).catch(() => '');

            // Create temporary file with new content
            const tempUri = vscode.Uri.joinPath(workspaceFolder.uri, `.${file}.migration.tmp`);
            await vscode.workspace.fs.writeFile(tempUri, Buffer.from(edit.newText || '', 'utf-8'));

            // Show diff
            await vscode.commands.executeCommand('vscode.diff', fileUri, tempUri, `${file} (Migration Preview)`);

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

        const analysis = result.analysis;
        const plan = result.refactorPlan;

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BunnyAI Migration Engine</title>
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
        .section {
            margin-bottom: 30px;
        }
        .section h2 {
            color: var(--vscode-textLink-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 5px;
            margin-bottom: 15px;
        }
        .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 12px;
            font-weight: bold;
            margin-left: 10px;
        }
        .badge.applicable {
            background-color: var(--vscode-testing-iconPassed);
            color: white;
        }
        .badge.not-applicable {
            background-color: var(--vscode-testing-iconQueued);
            color: white;
        }
        .badge.complexity-low {
            background-color: #4caf50;
            color: white;
        }
        .badge.complexity-medium {
            background-color: #ff9800;
            color: white;
        }
        .badge.complexity-high {
            background-color: #f44336;
            color: white;
        }
        .info-box {
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 3px solid var(--vscode-textLink-foreground);
            padding: 10px 15px;
            margin: 10px 0;
            border-radius: 3px;
        }
        .warning-box {
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 3px solid var(--vscode-testing-iconQueued);
            padding: 10px 15px;
            margin: 10px 0;
            border-radius: 3px;
        }
        .file-list {
            list-style: none;
            padding: 0;
        }
        .file-list li {
            padding: 8px;
            margin: 5px 0;
            background-color: var(--vscode-list-inactiveSelectionBackground);
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
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
        .example-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin: 15px 0;
        }
        .example-box {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px;
            padding: 10px;
        }
        .example-box h4 {
            margin-top: 0;
            color: var(--vscode-textLink-foreground);
        }
        .code-block {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 10px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
            overflow-x: auto;
            white-space: pre-wrap;
            max-height: 300px;
            overflow-y: auto;
        }
        .actions {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid var(--vscode-panel-border);
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Migration: ${result.migrationId}</h1>
        <span class="badge ${analysis.applicable ? 'applicable' : 'not-applicable'}">
            ${analysis.applicable ? 'Applicable' : 'Not Applicable'}
        </span>
        <span class="badge complexity-${analysis.estimatedComplexity}">
            ${analysis.estimatedComplexity.toUpperCase()} Complexity
        </span>
    </div>

    <div class="section">
        <h2>Summary</h2>
        <div class="info-box">
            ${analysis.summary}
        </div>
    </div>

    ${analysis.applicable ? `
    <div class="section">
        <h2>Files to Migrate (${analysis.filesToMigrate.length})</h2>
        <ul class="file-list">
            ${analysis.filesToMigrate.slice(0, 20).map(file => `<li>${file}</li>`).join('')}
            ${analysis.filesToMigrate.length > 20 ? `<li><em>... and ${analysis.filesToMigrate.length - 20} more</em></li>` : ''}
        </ul>
    </div>

    ${analysis.warnings.length > 0 ? `
    <div class="section">
        <h2>Warnings</h2>
        ${analysis.warnings.map(w => `<div class="warning-box">⚠️ ${w}</div>`).join('')}
    </div>
    ` : ''}

    ${analysis.recommendations.length > 0 ? `
    <div class="section">
        <h2>Recommendations</h2>
        <ul>
            ${analysis.recommendations.map(r => `<li>${r}</li>`).join('')}
        </ul>
    </div>
    ` : ''}

    ${plan ? `
    <div class="section">
        <h2>Migration Plan</h2>
        <div class="info-box">
            <strong>Edits:</strong> ${plan.edits?.length || 0} files<br>
            <strong>Moves:</strong> ${plan.moves?.length || 0} files<br>
            <strong>Creates:</strong> ${plan.creates?.length || 0} files<br>
            ${plan.summary ? `<br><strong>Summary:</strong> ${plan.summary}` : ''}
        </div>
        
        ${plan.edits && plan.edits.length > 0 ? `
        <h3>Files to Edit</h3>
        <ul class="file-list">
            ${plan.edits.slice(0, 10).map((edit, idx) => `
                <li>
                    ${edit.file}
                    <button class="button button-secondary" onclick="showDiff('${edit.file}', ${idx})">Show Diff</button>
                </li>
            `).join('')}
            ${plan.edits.length > 10 ? `<li><em>... and ${plan.edits.length - 10} more</em></li>` : ''}
        </ul>
        ` : ''}

        ${result.beforeExamples.length > 0 && result.afterExamples.length > 0 ? `
        <h3>Before / After Examples</h3>
        <div class="example-container">
            <div class="example-box">
                <h4>Before</h4>
                <div class="code-block">${this.escapeHtml(result.beforeExamples[0].content.substring(0, 500))}</div>
            </div>
            <div class="example-box">
                <h4>After</h4>
                <div class="code-block">${this.escapeHtml(result.afterExamples[0].content.substring(0, 500))}</div>
            </div>
        </div>
        ` : ''}
    </div>

    <div class="actions">
        <button class="button" onclick="applyMigration()" ${!plan ? 'disabled' : ''}>
            Apply Migration
        </button>
        <p><em>⚠️ Always review the changes before applying. This action cannot be easily undone.</em></p>
    </div>
    ` : `
    <div class="section">
        <h2>Migration Plan</h2>
        <div class="info-box">
            Generating migration plan... This may take a moment.
        </div>
    </div>
    `}
    ` : ''}

    <script>
        const vscode = acquireVsCodeApi();
        
        function applyMigration() {
            vscode.postMessage({
                command: 'applyMigration'
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
    <title>BunnyAI Migration Engine</title>
</head>
<body>
    <h1>No migration data available</h1>
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

