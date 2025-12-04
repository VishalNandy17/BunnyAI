import * as vscode from 'vscode';
import { RefactorAnalysisResult } from '../../refactor/refactorAnalyzer';
import { RefactorPlan, RefactorExecutor } from '../../refactor/refactorExecutor';

export class RefactorExplorerPanel {
    private static currentPanel: RefactorExplorerPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private currentPlan: RefactorPlan | undefined;
    private executor: RefactorExecutor | undefined;

    public static show(extensionUri: vscode.Uri, analysisResult: RefactorAnalysisResult) {
        if (RefactorExplorerPanel.currentPanel) {
            RefactorExplorerPanel.currentPanel.update(analysisResult);
            RefactorExplorerPanel.currentPanel.reveal();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'bunnyaiRefactorExplorer',
            'BunnyAI Refactor Explorer',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
                retainContextWhenHidden: true
            }
        );

        RefactorExplorerPanel.currentPanel = new RefactorExplorerPanel(panel, extensionUri);
        RefactorExplorerPanel.currentPanel.update(analysisResult);
    }

    private constructor(panel: vscode.WebviewPanel, private readonly extensionUri: vscode.Uri) {
        this.panel = panel;
        this.panel.webview.html = this.getHtml();
        this.panel.onDidDispose(() => {
            RefactorExplorerPanel.currentPanel = undefined;
        });

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'getDiff':
                    await this.handleGetDiff(message.file, message.editIndex);
                    break;
                case 'applyRefactor':
                    await this.handleApplyRefactor(message.selectedEdits, message.selectedMoves, message.selectedCreates);
                    break;
                case 'validatePlan':
                    await this.handleValidatePlan();
                    break;
            }
        });
    }

    private async handleGetDiff(file: string, editIndex: number) {
        if (!this.currentPlan || !this.executor) {
            return;
        }

        const edit = this.currentPlan.edits[editIndex];
        if (!edit || edit.file !== file) {
            return;
        }

        try {
            const diff = await this.executor.getEditDiff(edit);
            this.panel.webview.postMessage({
                type: 'diff',
                file,
                editIndex,
                diff
            });
        } catch (error) {
            this.panel.webview.postMessage({
                type: 'diffError',
                file,
                editIndex,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    private async handleApplyRefactor(
        selectedEdits: number[],
        selectedMoves: number[],
        selectedCreates: number[]
    ) {
        if (!this.currentPlan || !this.executor) {
            vscode.window.showErrorMessage('No refactor plan available');
            return;
        }

        // Confirm with user
        const confirm = await vscode.window.showWarningMessage(
            `Apply ${selectedEdits.length} edits, ${selectedMoves.length} moves, ${selectedCreates.length} creates?`,
            { modal: true },
            'Apply',
            'Cancel'
        );

        if (confirm !== 'Apply') {
            return;
        }

        try {
            const result = await this.executor.executePlan(
                this.currentPlan,
                selectedEdits,
                selectedMoves,
                selectedCreates
            );

            if (result.success) {
                vscode.window.showInformationMessage(
                    `Refactoring applied successfully! ${result.applied} changes applied.`
                );
                this.panel.webview.postMessage({
                    type: 'refactorApplied',
                    success: true,
                    applied: result.applied
                });
            } else {
                vscode.window.showErrorMessage(
                    `Refactoring failed: ${result.errors.join(', ')}`
                );
                this.panel.webview.postMessage({
                    type: 'refactorApplied',
                    success: false,
                    errors: result.errors
                });
            }
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to apply refactor: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    private async handleValidatePlan() {
        if (!this.currentPlan || !this.executor) {
            return;
        }

        try {
            const validation = await this.executor.validatePlan(this.currentPlan);
            this.panel.webview.postMessage({
                type: 'validation',
                validation
            });
        } catch (error) {
            this.panel.webview.postMessage({
                type: 'validationError',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    private reveal() {
        this.panel.reveal(undefined, true);
    }

    private update(analysisResult: RefactorAnalysisResult) {
        // Initialize executor if we have a plan
        if (analysisResult.refactorPlan) {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                this.executor = new RefactorExecutor(workspaceFolder.uri.fsPath);
                this.currentPlan = analysisResult.refactorPlan;
            }
        }

        this.panel.webview.postMessage({
            type: 'update',
            payload: analysisResult
        });
    }

    private getHtml(): string {
        const nonce = this.getNonce();
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${this.panel.webview.cspSource}; script-src 'nonce-${nonce}';">
    <title>BunnyAI Refactor Explorer</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            padding: 20px;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            line-height: 1.6;
        }
        .header {
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid var(--vscode-panel-border);
        }
        .header h1 {
            color: var(--vscode-textLink-foreground);
            margin-bottom: 10px;
        }
        .section {
            margin-bottom: 30px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 20px;
        }
        .section h2 {
            color: var(--vscode-textLink-foreground);
            margin-bottom: 15px;
            font-size: 1.3em;
        }
        .complexity-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 0.85em;
            font-weight: bold;
            margin-left: 10px;
        }
        .badge-high {
            background: var(--vscode-inputValidation-errorBackground);
            color: var(--vscode-inputValidation-errorForeground);
        }
        .badge-medium {
            background: var(--vscode-inputValidation-warningBackground);
            color: var(--vscode-inputValidation-warningForeground);
        }
        .badge-low {
            background: var(--vscode-inputValidation-infoBackground);
            color: var(--vscode-inputValidation-infoForeground);
        }
        .file-list {
            list-style: none;
            margin-top: 10px;
        }
        .file-list li {
            padding: 8px;
            margin: 5px 0;
            background: var(--vscode-list-inactiveSelectionBackground);
            border-left: 3px solid var(--vscode-textLink-foreground);
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
        }
        .cycle {
            padding: 10px;
            margin: 10px 0;
            background: var(--vscode-inputValidation-errorBackground);
            border-left: 4px solid var(--vscode-inputValidation-errorBorder);
            border-radius: 3px;
        }
        .smell-item {
            padding: 12px;
            margin: 10px 0;
            border-left: 4px solid;
            border-radius: 3px;
        }
        .smell-high {
            background: var(--vscode-inputValidation-errorBackground);
            border-color: var(--vscode-inputValidation-errorBorder);
        }
        .smell-medium {
            background: var(--vscode-inputValidation-warningBackground);
            border-color: var(--vscode-inputValidation-warningBorder);
        }
        .smell-low {
            background: var(--vscode-inputValidation-infoBackground);
            border-color: var(--vscode-inputValidation-infoBorder);
        }
        .proposal-section {
            margin-top: 20px;
        }
        .proposal-item {
            padding: 15px;
            margin: 10px 0;
            background: var(--vscode-list-hoverBackground);
            border-radius: 4px;
        }
        .proposal-item h3 {
            color: var(--vscode-textLink-foreground);
            margin-bottom: 8px;
        }
        .proposal-item p {
            color: var(--vscode-descriptionForeground);
            margin-top: 5px;
        }
        .loading {
            text-align: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
        }
        .empty-state {
            text-align: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
        }
        .refactor-plan {
            margin-top: 30px;
        }
        .edit-item, .move-item, .create-item {
            padding: 15px;
            margin: 10px 0;
            background: var(--vscode-list-hoverBackground);
            border-radius: 4px;
            border: 1px solid var(--vscode-panel-border);
        }
        .edit-item.selected {
            border-color: var(--vscode-textLink-foreground);
        }
        .edit-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
        }
        .edit-header input[type="checkbox"] {
            width: 18px;
            height: 18px;
            cursor: pointer;
        }
        .diff-preview {
            margin-top: 10px;
            padding: 10px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 0.85em;
            max-height: 200px;
            overflow-y: auto;
            white-space: pre-wrap;
        }
        .diff-line {
            padding: 2px 5px;
        }
        .diff-line.added {
            background: var(--vscode-diffEditor-insertedTextBackground);
            color: var(--vscode-diffEditor-insertedTextForeground);
        }
        .diff-line.removed {
            background: var(--vscode-diffEditor-removedTextBackground);
            color: var(--vscode-diffEditor-removedTextForeground);
        }
        .diff-line.context {
            color: var(--vscode-descriptionForeground);
        }
        .show-diff-btn {
            margin-top: 5px;
            padding: 5px 10px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 0.9em;
        }
        .show-diff-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .apply-section {
            margin-top: 30px;
            padding: 20px;
            background: var(--vscode-editor-background);
            border: 2px solid var(--vscode-textLink-foreground);
            border-radius: 4px;
            text-align: center;
        }
        .apply-btn {
            padding: 12px 24px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 1.1em;
            font-weight: bold;
            margin-top: 10px;
        }
        .apply-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .apply-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .validation-errors {
            margin-top: 15px;
            padding: 10px;
            background: var(--vscode-inputValidation-errorBackground);
            border-left: 4px solid var(--vscode-inputValidation-errorBorder);
            border-radius: 3px;
        }
        .validation-warnings {
            margin-top: 15px;
            padding: 10px;
            background: var(--vscode-inputValidation-warningBackground);
            border-left: 4px solid var(--vscode-inputValidation-warningBorder);
            border-radius: 3px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔧 Workspace Refactor Analysis</h1>
        <p>Comprehensive analysis of your codebase for refactoring opportunities</p>
    </div>

    <div id="content">
        <div class="loading">Loading analysis...</div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        let currentData = null;

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'update') {
                currentData = message.payload;
                renderAnalysis(currentData);
            } else if (message.type === 'diff') {
                const diffContainer = document.getElementById('diff-' + message.editIndex);
                if (diffContainer && message.diff) {
                    const lines = message.diff.split('\n');
                    diffContainer.innerHTML = '';
                    lines.forEach(line => {
                        const div = document.createElement('div');
                        div.className = 'diff-line';
                        if (line.startsWith('+')) {
                            div.className += ' added';
                            div.textContent = line;
                        } else if (line.startsWith('-')) {
                            div.className += ' removed';
                            div.textContent = line;
                        } else {
                            div.className += ' context';
                            div.textContent = line;
                        }
                        diffContainer.appendChild(div);
                    });
                }
            } else if (message.type === 'validation') {
                const validationDiv = document.getElementById('validation-results');
                if (validationDiv) {
                    let html = '';
                    if (message.validation.errors && message.validation.errors.length > 0) {
                        html += '<div class="validation-errors">';
                        html += '<strong>Errors:</strong><ul>';
                        message.validation.errors.forEach(err => {
                            html += '<li>' + escapeHtml(err) + '</li>';
                        });
                        html += '</ul></div>';
                    }
                    if (message.validation.warnings && message.validation.warnings.length > 0) {
                        html += '<div class="validation-warnings">';
                        html += '<strong>Warnings:</strong><ul>';
                        message.validation.warnings.forEach(warn => {
                            html += '<li>' + escapeHtml(warn) + '</li>';
                        });
                        html += '</ul></div>';
                    }
                    validationDiv.innerHTML = html;
                }
            } else if (message.type === 'refactorApplied') {
                if (message.success) {
                    alert('Refactoring applied successfully! ' + message.applied + ' changes applied.');
                } else {
                    alert('Refactoring failed: ' + (message.errors || []).join(', '));
                }
            }
        });

        function renderAnalysis(data) {
            const content = document.getElementById('content');
            
            if (!data) {
                content.innerHTML = '<div class="empty-state">No analysis data available</div>';
                return;
            }

            let html = '';

            // Complex Modules
            if (data.complexModules && data.complexModules.length > 0) {
                html += '<div class="section">';
                html += '<h2>🔴 Most Complex Modules</h2>';
                data.complexModules.forEach(module => {
                    const badgeClass = module.averageComplexity > 15 ? 'badge-high' : 
                                      module.averageComplexity > 10 ? 'badge-medium' : 'badge-low';
                    html += '<div class="proposal-item">';
                    html += '<h3>Module <span class="complexity-badge ' + badgeClass + '">Avg: ' + module.averageComplexity + ', Max: ' + module.maxComplexity + '</span></h3>';
                    html += '<p>' + module.reason + '</p>';
                    html += '<ul class="file-list">';
                    module.files.slice(0, 5).forEach(file => {
                        html += '<li>' + escapeHtml(file) + '</li>';
                    });
                    if (module.files.length > 5) {
                        html += '<li>... and ' + (module.files.length - 5) + ' more</li>';
                    }
                    html += '</ul>';
                    html += '</div>';
                });
                html += '</div>';
            }

            // Circular Dependencies
            if (data.circularDependencies && data.circularDependencies.length > 0) {
                html += '<div class="section">';
                html += '<h2>🔄 Circular Dependencies</h2>';
                data.circularDependencies.forEach((cycle, idx) => {
                    html += '<div class="cycle">';
                    html += '<strong>Cycle ' + (idx + 1) + ':</strong> ' + cycle.join(' → ') + ' → ' + cycle[0];
                    html += '</div>';
                });
                html += '</div>';
            }

            // Architecture Smells
            if (data.architectureSmells && data.architectureSmells.length > 0) {
                html += '<div class="section">';
                html += '<h2>⚠️ Architecture Smells</h2>';
                data.architectureSmells.forEach(smell => {
                    const smellClass = 'smell-' + smell.severity;
                    html += '<div class="smell-item ' + smellClass + '">';
                    html += '<strong>[' + smell.severity.toUpperCase() + '] ' + escapeHtml(smell.type) + '</strong>';
                    html += '<p>' + escapeHtml(smell.description) + '</p>';
                    if (smell.affectedFiles && smell.affectedFiles.length > 0) {
                        html += '<p><small>Affected: ' + smell.affectedFiles.slice(0, 3).join(', ') + 
                               (smell.affectedFiles.length > 3 ? '...' : '') + '</small></p>';
                    }
                    html += '</div>';
                });
                html += '</div>';
            }

            // AI Proposal
            if (data.aiProposal) {
                html += '<div class="section proposal-section">';
                html += '<h2>🤖 AI Refactoring Proposal</h2>';

                // Files to Refactor
                if (data.aiProposal.filesToRefactor && data.aiProposal.filesToRefactor.length > 0) {
                    html += '<h3>Files to Refactor</h3>';
                    data.aiProposal.filesToRefactor.forEach(item => {
                        const badgeClass = 'badge-' + item.priority;
                        html += '<div class="proposal-item">';
                        html += '<h3>' + escapeHtml(item.file) + ' <span class="complexity-badge ' + badgeClass + '">' + item.priority.toUpperCase() + '</span></h3>';
                        html += '<p>' + escapeHtml(item.reason) + '</p>';
                        html += '</div>';
                    });
                }

                // Files to Move
                if (data.aiProposal.filesToMove && data.aiProposal.filesToMove.length > 0) {
                    html += '<h3>Files to Move</h3>';
                    data.aiProposal.filesToMove.forEach(item => {
                        html += '<div class="proposal-item">';
                        html += '<h3>' + escapeHtml(item.file) + '</h3>';
                        html += '<p><strong>From:</strong> ' + escapeHtml(item.currentPath) + '</p>';
                        html += '<p><strong>To:</strong> ' + escapeHtml(item.suggestedPath) + '</p>';
                        html += '<p>' + escapeHtml(item.reason) + '</p>';
                        html += '</div>';
                    });
                }

                // New Structure
                if (data.aiProposal.newStructure) {
                    html += '<h3>Recommended Structure</h3>';
                    html += '<div class="proposal-item">';
                    html += '<p>' + escapeHtml(data.aiProposal.newStructure.description) + '</p>';
                    if (data.aiProposal.newStructure.recommendedFolders && data.aiProposal.newStructure.recommendedFolders.length > 0) {
                        html += '<ul class="file-list">';
                        data.aiProposal.newStructure.recommendedFolders.forEach(folder => {
                            html += '<li>' + escapeHtml(folder) + '</li>';
                        });
                        html += '</ul>';
                    }
                    html += '</div>';
                }

                // Code Transformations
                if (data.aiProposal.codeTransformations && data.aiProposal.codeTransformations.length > 0) {
                    html += '<h3>Code Transformations</h3>';
                    data.aiProposal.codeTransformations.forEach(item => {
                        html += '<div class="proposal-item">';
                        html += '<h3>' + escapeHtml(item.file) + ' → ' + escapeHtml(item.transformation) + '</h3>';
                        html += '<p>' + escapeHtml(item.description) + '</p>';
                        html += '</div>';
                    });
                }

                // Architecture Improvements
                if (data.aiProposal.architectureImprovements && data.aiProposal.architectureImprovements.length > 0) {
                    html += '<h3>Architecture Improvements</h3>';
                    html += '<ul class="file-list">';
                    data.aiProposal.architectureImprovements.forEach(improvement => {
                        html += '<li>' + escapeHtml(improvement) + '</li>';
                    });
                    html += '</ul>';
                }

                html += '</div>';
            }

            // Refactor Plan (Executable)
            if (data.refactorPlan) {
                html += '<div class="section refactor-plan">';
                html += '<h2>⚡ Executable Refactor Plan</h2>';
                html += '<p>' + escapeHtml(data.refactorPlan.summary || 'Ready to apply refactoring changes') + '</p>';

                // Edits
                if (data.refactorPlan.edits && data.refactorPlan.edits.length > 0) {
                    html += '<h3>Code Edits (' + data.refactorPlan.edits.length + ')</h3>';
                    data.refactorPlan.edits.forEach((edit, idx) => {
                        html += '<div class="edit-item" data-edit-index="' + idx + '">';
                        html += '<div class="edit-header">';
                        html += '<input type="checkbox" id="edit-' + idx + '" checked data-edit-index="' + idx + '">';
                        html += '<label for="edit-' + idx + '"><strong>' + escapeHtml(edit.file) + '</strong></label>';
                        html += '</div>';
                        if (edit.description) {
                            html += '<p style="margin: 5px 0; color: var(--vscode-descriptionForeground);">' + escapeHtml(edit.description) + '</p>';
                        }
                        html += '<button class="show-diff-btn" onclick="showDiff(\'' + escapeHtml(edit.file) + '\', ' + idx + ')">Show Diff</button>';
                        html += '<div id="diff-' + idx + '" class="diff-preview" style="display: none;"></div>';
                        html += '</div>';
                    });
                }

                // Moves
                if (data.refactorPlan.moves && data.refactorPlan.moves.length > 0) {
                    html += '<h3>File Moves (' + data.refactorPlan.moves.length + ')</h3>';
                    data.refactorPlan.moves.forEach((move, idx) => {
                        html += '<div class="move-item">';
                        html += '<div class="edit-header">';
                        html += '<input type="checkbox" id="move-' + idx + '" checked data-move-index="' + idx + '">';
                        html += '<label for="move-' + idx + '"><strong>' + escapeHtml(move.from) + '</strong> → <strong>' + escapeHtml(move.to) + '</strong></label>';
                        html += '</div>';
                        if (move.reason) {
                            html += '<p style="margin: 5px 0; color: var(--vscode-descriptionForeground);">' + escapeHtml(move.reason) + '</p>';
                        }
                        html += '</div>';
                    });
                }

                // Creates
                if (data.refactorPlan.creates && data.refactorPlan.creates.length > 0) {
                    html += '<h3>New Files (' + data.refactorPlan.creates.length + ')</h3>';
                    data.refactorPlan.creates.forEach((create, idx) => {
                        html += '<div class="create-item">';
                        html += '<div class="edit-header">';
                        html += '<input type="checkbox" id="create-' + idx + '" checked data-create-index="' + idx + '">';
                        html += '<label for="create-' + idx + '"><strong>' + escapeHtml(create.file) + '</strong></label>';
                        html += '</div>';
                        if (create.description) {
                            html += '<p style="margin: 5px 0; color: var(--vscode-descriptionForeground);">' + escapeHtml(create.description) + '</p>';
                        }
                        html += '</div>';
                    });
                }

                // Apply Section
                html += '<div class="apply-section">';
                html += '<h3>Ready to Apply Refactoring</h3>';
                html += '<p>Review the changes above and select which ones to apply.</p>';
                html += '<button class="apply-btn" onclick="applyRefactor()">Apply Selected Refactoring</button>';
                html += '<div id="validation-results"></div>';
                html += '</div>';

                html += '</div>';
            }

            if (!html) {
                html = '<div class="empty-state">No refactoring opportunities found</div>';
            }

            content.innerHTML = html;
            
            // Auto-validate plan on load
            if (data.refactorPlan) {
                vscode.postMessage({ command: 'validatePlan' });
            }
        }

        function showDiff(file, editIndex) {
            const diffContainer = document.getElementById('diff-' + editIndex);
            const btn = event.target;
            
            if (diffContainer.style.display === 'none' || !diffContainer.style.display) {
                diffContainer.style.display = 'block';
                diffContainer.textContent = 'Loading diff...';
                btn.textContent = 'Hide Diff';
                vscode.postMessage({ command: 'getDiff', file: file, editIndex: editIndex });
            } else {
                diffContainer.style.display = 'none';
                btn.textContent = 'Show Diff';
            }
        }

        function applyRefactor() {
            const selectedEdits = [];
            const selectedMoves = [];
            const selectedCreates = [];

            // Collect selected edits
            document.querySelectorAll('input[type="checkbox"][data-edit-index]').forEach(cb => {
                if (cb.checked) {
                    selectedEdits.push(parseInt(cb.getAttribute('data-edit-index')));
                }
            });

            // Collect selected moves
            document.querySelectorAll('input[type="checkbox"][data-move-index]').forEach(cb => {
                if (cb.checked) {
                    selectedMoves.push(parseInt(cb.getAttribute('data-move-index')));
                }
            });

            // Collect selected creates
            document.querySelectorAll('input[type="checkbox"][data-create-index]').forEach(cb => {
                if (cb.checked) {
                    selectedCreates.push(parseInt(cb.getAttribute('data-create-index')));
                }
            });

            if (selectedEdits.length === 0 && selectedMoves.length === 0 && selectedCreates.length === 0) {
                alert('Please select at least one change to apply.');
                return;
            }

            vscode.postMessage({
                command: 'applyRefactor',
                selectedEdits: selectedEdits,
                selectedMoves: selectedMoves,
                selectedCreates: selectedCreates
            });
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

