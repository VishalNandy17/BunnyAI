import * as vscode from 'vscode';
import { ExtensionCore } from './core/ExtensionCore';
import { Logger } from './utils/logger';
import { WebviewManager } from './webview/WebviewManager';
import { WorkspaceStorage } from './storage/WorkspaceStorage';
import { SecretStorage } from './storage/SecretStorage';
import { HistoryManager } from './core/HistoryManager';
import { ConfigManager } from './core/ConfigManager';
import { WorkspaceDetector } from './core/WorkspaceDetector';
import { AITestGenerator } from './ai/AITestGenerator';
import { AIErrorAnalyzer } from './ai/AIErrorAnalyzer';
import { AIDocGenerator } from './ai/AIDocGenerator';
import { RequestPanel } from './webview/panels/RequestPanel';
import { CodeQualityAnalyzer, FunctionMetric, FileQualityReport } from './analysis/codeQualityAnalyzer';
import { CodeQualityPanel } from './webview/panels/CodeQualityPanel';
import { AIProvider } from './ai/AIProvider';
import { removeComments } from './analysis/commentRemover';
import { scanSecurity, SecurityScanResult, SecurityIssue } from './analysis/securityScanner';

let statusBarItem: vscode.StatusBarItem;
let statusBarBaseTooltip = '';
let codeQualityChannel: vscode.OutputChannel | undefined;
let codeQualityDiagnostics: vscode.DiagnosticCollection | undefined;
let codeQualityWarningDecoration: vscode.TextEditorDecorationType | undefined;
let codeQualityErrorDecoration: vscode.TextEditorDecorationType | undefined;
let extensionContext: vscode.ExtensionContext | undefined;
let securityChannel: vscode.OutputChannel | undefined;
let securityDiagnostics: vscode.DiagnosticCollection | undefined;
let lastSecurityScanResult: SecurityScanResult | undefined;

export async function activate(context: vscode.ExtensionContext) {
    extensionContext = context;
    Logger.initialize('BunnyAI Pro');
    Logger.log('Activating BunnyAI Pro...');

    try {
        // Initialize storage first
        WorkspaceStorage.initialize(context);
        SecretStorage.initialize(context);
        HistoryManager.initialize(WorkspaceStorage.getInstance());

        // Initialize configuration manager
        ConfigManager.getInstance();

        // Detect framework
        const detector = WorkspaceDetector.getInstance();
        const frameworkInfo = await detector.detectFramework();
        Logger.log(`Detected framework: ${frameworkInfo.framework} (confidence: ${frameworkInfo.confidence})`);

        // Create status bar item
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        statusBarItem.text = `$(bunny) BunnyAI`;
        statusBarBaseTooltip = `Framework: ${frameworkInfo.framework}`;
        statusBarItem.tooltip = `BunnyAI Pro - ${statusBarBaseTooltip}`;
        statusBarItem.command = 'bunnyai.showStatus';
        statusBarItem.show();
        context.subscriptions.push(statusBarItem);

        const core = ExtensionCore.initialize(context);
        await core.activate();

        // Set up RequestPanel callback to refresh history
        RequestPanel.setOnRequestExecuted(() => {
            core.getHistoryTreeProvider().refresh();
        });

        // Initialize AI providers
        const testGenerator = new AITestGenerator();
        const errorAnalyzer = new AIErrorAnalyzer();
        const docGenerator = new AIDocGenerator();
        const aiProvider = new AIProvider();

        // Register commands with error handling
        const codeQualityAnalyzer = new CodeQualityAnalyzer();
        codeQualityChannel = vscode.window.createOutputChannel('BunnyAI Code Quality');
        codeQualityDiagnostics = vscode.languages.createDiagnosticCollection('bunnyai-code-quality');
        codeQualityWarningDecoration = vscode.window.createTextEditorDecorationType({
            isWholeLine: false,
            backgroundColor: new vscode.ThemeColor('editor.hoverHighlightBackground'),
            borderColor: new vscode.ThemeColor('editorWarning.foreground'),
            borderStyle: 'solid',
            borderWidth: '1px'
        });
        codeQualityErrorDecoration = vscode.window.createTextEditorDecorationType({
            isWholeLine: false,
            backgroundColor: new vscode.ThemeColor('editor.selectionHighlightBackground'),
            borderColor: new vscode.ThemeColor('editorError.foreground'),
            borderStyle: 'solid',
            borderWidth: '1px'
        });
        securityChannel = vscode.window.createOutputChannel('BunnyAI Security');
        securityDiagnostics = vscode.languages.createDiagnosticCollection('bunnyai-security');
        context.subscriptions.push(codeQualityChannel, codeQualityDiagnostics, codeQualityWarningDecoration, codeQualityErrorDecoration, securityChannel, securityDiagnostics);

        context.subscriptions.push(
            vscode.commands.registerCommand('bunnyai.runApi', async (route) => {
                try {
                    Logger.log(`Running API: ${route?.method} ${route?.path}`);
                    WebviewManager.getInstance().openRequestPanel(route);
                    // Refresh history tree
                    const core = ExtensionCore.getInstance();
                    core.getHistoryTreeProvider().refresh();
                } catch (error) {
                    Logger.error('Failed to run API command', error);
                    vscode.window.showErrorMessage('Failed to open API request panel. Check output for details.');
                }
            }),
            vscode.commands.registerCommand('bunnyai.generateTests', async () => {
                try {
                    const editor = vscode.window.activeTextEditor;
                    if (!editor) {
                        vscode.window.showWarningMessage('No active editor. Please open a file to generate tests.');
                        return;
                    }

                    const selectedText = editor.document.getText(editor.selection) || editor.document.getText();
                    if (!selectedText.trim()) {
                        vscode.window.showWarningMessage('No code selected. Please select code to generate tests for.');
                        return;
                    }

                    vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: 'Generating Tests',
                        cancellable: false
                    }, async (progress) => {
                        progress.report({ increment: 0, message: 'Generating tests...' });
                        
                        try {
                            const tests = await testGenerator.generateTests(selectedText);
                            
                            // Create a new document with the generated tests
                            const doc = await vscode.workspace.openTextDocument({
                                content: tests,
                                language: editor.document.languageId
                            });
                            await vscode.window.showTextDocument(doc);
                            
                            vscode.window.showInformationMessage('Tests generated successfully!');
                        } catch (error: any) {
                            vscode.window.showErrorMessage(`Failed to generate tests: ${error.message}`);
                            throw error;
                        }
                    });
                } catch (error) {
                    Logger.error('Failed to generate tests', error);
                    vscode.window.showErrorMessage('Failed to generate tests. Check output for details.');
                }
            }),
            vscode.commands.registerCommand('bunnyai.analyzeError', async () => {
                try {
                    const editor = vscode.window.activeTextEditor;
                    if (!editor) {
                        vscode.window.showWarningMessage('No active editor. Please select an error to analyze.');
                        return;
                    }

                    const selectedText = editor.document.getText(editor.selection);
                    if (!selectedText.trim()) {
                        vscode.window.showWarningMessage('No error selected. Please select an error message to analyze.');
                        return;
                    }

                    vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: 'Analyzing Error',
                        cancellable: false
                    }, async (progress) => {
                        progress.report({ increment: 0, message: 'Analyzing error...' });
                        
                        try {
                            const analysis = await errorAnalyzer.analyze(selectedText);
                            
                            // Show analysis in a new document
                            const doc = await vscode.workspace.openTextDocument({
                                content: analysis,
                                language: 'markdown'
                            });
                            await vscode.window.showTextDocument(doc);
                            
                            vscode.window.showInformationMessage('Error analysis complete!');
                        } catch (error: any) {
                            vscode.window.showErrorMessage(`Failed to analyze error: ${error.message}`);
                            throw error;
                        }
                    });
                } catch (error) {
                    Logger.error('Failed to analyze error', error);
                    vscode.window.showErrorMessage('Failed to analyze error. Check output for details.');
                }
            }),
            vscode.commands.registerCommand('bunnyai.generateDocs', async () => {
                try {
                    const editor = vscode.window.activeTextEditor;
                    if (!editor) {
                        vscode.window.showWarningMessage('No active editor. Please open a file to generate documentation.');
                        return;
                    }

                    const selectedText = editor.document.getText(editor.selection) || editor.document.getText();
                    if (!selectedText.trim()) {
                        vscode.window.showWarningMessage('No code selected. Please select code to generate documentation for.');
                        return;
                    }

                    vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: 'Generating Documentation',
                        cancellable: false
                    }, async (progress) => {
                        progress.report({ increment: 0, message: 'Generating documentation...' });
                        
                        try {
                            const docs = await docGenerator.generateDocs(selectedText);
                            
                            // Insert documentation above selected code or at cursor
                            const editor = vscode.window.activeTextEditor;
                            if (editor) {
                                const position = editor.selection.start;
                                await editor.edit(editBuilder => {
                                    editBuilder.insert(position, docs + '\n\n');
                                });
                            }
                            
                            vscode.window.showInformationMessage('Documentation generated successfully!');
                        } catch (error: any) {
                            vscode.window.showErrorMessage(`Failed to generate documentation: ${error.message}`);
                            throw error;
                        }
                    });
                } catch (error) {
                    Logger.error('Failed to generate documentation', error);
                    vscode.window.showErrorMessage('Failed to generate documentation. Check output for details.');
                }
            }),
            vscode.commands.registerCommand('bunnyai.configureApiKey', async () => {
                try {
                    const secretStorage = SecretStorage.getInstance();
                    const configManager = ConfigManager.getInstance();

                    const existingSecret = await secretStorage.get('bunnyai.aiApiKey');
                    const existingConfig = configManager.getAIApiKey();

                    const apiKey = await vscode.window.showInputBox({
                        prompt: 'Enter your AI API key (OpenAI, Anthropic, or custom provider)',
                        placeHolder: 'sk-...',
                        password: true,
                        value: existingSecret || existingConfig || ''
                    });

                    if (!apiKey) {
                        return;
                    }

                    await secretStorage.set('bunnyai.aiApiKey', apiKey);

                    // Clear legacy config-based key to avoid storing secrets in plain text.
                    if (existingConfig) {
                        await configManager.update('aiApiKey', '');
                    }

                    vscode.window.showInformationMessage('AI API key saved securely to VS Code Secret Storage.');
                } catch (error) {
                    Logger.error('Failed to configure AI API key', error);
                    vscode.window.showErrorMessage('Failed to configure AI API key. See output for details.');
                }
            }),
            vscode.commands.registerCommand('bunnyai.showStatus', () => {
                vscode.window.showInformationMessage(
                    `BunnyAI Pro is active. Framework: ${frameworkInfo.framework}`
                );
            }),
            vscode.commands.registerCommand('bunnyai.refreshHistory', () => {
                const core = ExtensionCore.getInstance();
                core.getHistoryTreeProvider().refresh();
            }),
            vscode.commands.registerCommand('bunnyai.refreshCollections', () => {
                const core = ExtensionCore.getInstance();
                core.getCollectionProvider().refresh();
            }),
            vscode.commands.registerCommand('bunnyai.clearHistory', async () => {
                try {
                    await HistoryManager.getInstance().clearHistory();
                    const core = ExtensionCore.getInstance();
                    core.getHistoryTreeProvider().refresh();
                    vscode.window.showInformationMessage('History cleared');
                } catch (error) {
                    Logger.error('Failed to clear history', error);
                    vscode.window.showErrorMessage('Failed to clear history');
                }
            }),
            vscode.commands.registerCommand('bunnyai.analyzeCodeQuality', async () => {
                try {
                    const editor = vscode.window.activeTextEditor;
                    if (!editor) {
                        vscode.window.showWarningMessage('Open a file to analyze its code quality.');
                        return;
                    }

                    const report = codeQualityAnalyzer.analyzeDocument(editor.document);
                    renderQualityReport(report);
                    applyDiagnosticsAndDecorations(editor, report.functions);
                    updateCodeQualityStatus(report.functions);
                    if (extensionContext) {
                        CodeQualityPanel.show(extensionContext.extensionUri, report);
                    }

                    vscode.window.showInformationMessage('Code quality analysis completed.');
                } catch (error) {
                    Logger.error('Failed to analyze code quality', error);
                    vscode.window.showErrorMessage('Failed to analyze code quality. Check output for details.');
                }
            }),
            vscode.commands.registerCommand('bunnyai.reviewAndRefactorSelection', async () => {
                try {
                    const editor = vscode.window.activeTextEditor;
                    if (!editor) {
                        vscode.window.showWarningMessage('No active editor. Open a file to review and refactor.');
                        return;
                    }

                    const document = editor.document;
                    const selection = editor.selection;
                    const hasSelection = selection && !selection.isEmpty;

                    let targetRange: vscode.Range;
                    if (hasSelection) {
                        targetRange = selection;
                    } else {
                        const lastLine = document.lineCount - 1;
                        targetRange = new vscode.Range(0, 0, lastLine, document.lineAt(lastLine).range.end.character);
                    }

                    const selectedCode = document.getText(targetRange);
                    if (!selectedCode.trim()) {
                        vscode.window.showWarningMessage('Nothing to review. Select code or ensure the file is not empty.');
                        return;
                    }

                    const contextStart = Math.max(targetRange.start.line - 10, 0);
                    const contextEnd = Math.min(targetRange.end.line + 10, document.lineCount - 1);
                    const contextRange = new vscode.Range(
                        contextStart,
                        0,
                        contextEnd,
                        document.lineAt(contextEnd).range.end.character
                    );
                    const contextText = document.getText(contextRange);

                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: 'Reviewing & Refactoring Selection',
                        cancellable: false
                    }, async (progress) => {
                        progress.report({ increment: 0, message: 'Contacting AI reviewer...' });

                        try {
                            const response = await aiProvider.reviewAndRefactor(
                                selectedCode,
                                document.languageId,
                                contextText
                            );
                            const { review, refactor } = parseReviewAndRefactor(response);

                            if (!refactor.trim()) {
                                vscode.window.showWarningMessage('AI did not return a refactored snippet.');
                                return;
                            }

                            const originalDoc = await vscode.workspace.openTextDocument({
                                content: selectedCode,
                                language: document.languageId
                            });
                            const refactoredDoc = await vscode.workspace.openTextDocument({
                                content: refactor,
                                language: document.languageId
                            });

                            const title = `BunnyAI Refactor: ${document.fileName}`;
                            await vscode.commands.executeCommand(
                                'vscode.diff',
                                originalDoc.uri,
                                refactoredDoc.uri,
                                title
                            );

                            if (review.trim()) {
                                renderTextReview(review);
                            }

                            const choice = await vscode.window.showQuickPick(
                                ['Apply refactor', 'Cancel'],
                                {
                                    placeHolder: 'Apply BunnyAI refactor to the current document?',
                                    ignoreFocusOut: true
                                }
                            );

                            if (choice === 'Apply refactor') {
                                await editor.edit((editBuilder) => {
                                    editBuilder.replace(targetRange, refactor);
                                });
                                vscode.window.showInformationMessage('Refactor applied to document.');
                            }
                        } catch (error: any) {
                            vscode.window.showErrorMessage(`Failed to review/refactor selection: ${error.message}`);
                            throw error;
                        }
                    });
                } catch (error) {
                    Logger.error('Failed to run Review & Refactor Selection command', error);
                    vscode.window.showErrorMessage('Failed to review/refactor selection. Check output for details.');
                }
            }),
            vscode.commands.registerCommand('bunnyai.removeComments', async () => {
                try {
                    const editor = vscode.window.activeTextEditor;
                    if (!editor) {
                        vscode.window.showWarningMessage('No active editor. Open a file to remove comments from.');
                        return;
                    }

                    const document = editor.document;
                    const selection = editor.selection;
                    const hasSelection = selection && !selection.isEmpty;

                    let targetRange: vscode.Range;
                    if (hasSelection) {
                        targetRange = selection;
                    } else {
                        const lastLine = document.lineCount - 1;
                        targetRange = new vscode.Range(0, 0, lastLine, document.lineAt(lastLine).range.end.character);
                    }

                    const text = document.getText(targetRange);
                    if (!text.trim()) {
                        vscode.window.showWarningMessage('Nothing to process. Select code or ensure the file is not empty.');
                        return;
                    }

                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: 'Removing Comments',
                        cancellable: false
                    }, async () => {
                        const result = removeComments(text, document.languageId);
                        await editor.edit((editBuilder) => {
                            editBuilder.replace(targetRange, result.withoutComments);
                        });

                        const count = result.removedComments.length;
                        if (count > 0) {
                            vscode.window.showInformationMessage(`Removed ${count} comment${count === 1 ? '' : 's'}.`);
                        } else {
                            vscode.window.showInformationMessage('No comments found to remove.');
                        }
                    });
                } catch (error) {
                    Logger.error('Failed to remove comments', error);
                    vscode.window.showErrorMessage('Failed to remove comments. Check output for details.');
                }
            }),
            vscode.commands.registerCommand('bunnyai.securityScanFile', async () => {
                try {
                    const editor = vscode.window.activeTextEditor;
                    if (!editor) {
                        vscode.window.showWarningMessage('No active editor. Open a file to scan for security issues.');
                        return;
                    }

                    const document = editor.document;
                    const code = document.getText();
                    const filePath = document.fileName;

                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: 'Scanning for Security Issues',
                        cancellable: false
                    }, async () => {
                        const result = scanSecurity(code, document.languageId, filePath);
                        lastSecurityScanResult = result;

                        // Clear previous diagnostics
                        if (securityDiagnostics) {
                            securityDiagnostics.clear();
                        }

                        // Create diagnostics
                        const diagnostics: vscode.Diagnostic[] = [];
                        for (const issue of result.issues) {
                            const line = Math.max(0, issue.line - 1);
                            const lineText = document.lineAt(line).text;
                            const range = new vscode.Range(line, 0, line, lineText.length);

                            let severity: vscode.DiagnosticSeverity;
                            switch (issue.severity) {
                                case 'high':
                                    severity = vscode.DiagnosticSeverity.Error;
                                    break;
                                case 'medium':
                                    severity = vscode.DiagnosticSeverity.Warning;
                                    break;
                                case 'low':
                                    severity = vscode.DiagnosticSeverity.Information;
                                    break;
                            }

                            diagnostics.push(new vscode.Diagnostic(range, issue.message, severity));
                        }

                        if (securityDiagnostics) {
                            securityDiagnostics.set(document.uri, diagnostics);
                        }

                        // Show in output channel
                        if (securityChannel) {
                            securityChannel.clear();
                            securityChannel.appendLine(`Security Scan Results: ${filePath}`);
                            securityChannel.appendLine(`Found ${result.issues.length} potential security issue(s)\n`);

                            if (result.issues.length === 0) {
                                securityChannel.appendLine('✓ No security issues detected.');
                            } else {
                                for (const issue of result.issues) {
                                    securityChannel.appendLine(`[${issue.severity.toUpperCase()}] Line ${issue.line}: ${issue.message}`);
                                    securityChannel.appendLine(`Rule: ${issue.ruleId}`);
                                    securityChannel.appendLine(`Code:\n${issue.codeSnippet}\n`);
                                }
                            }
                            securityChannel.show(true);
                        }

                        const count = result.issues.length;
                        if (count > 0) {
                            vscode.window.showInformationMessage(`Security scan found ${count} issue${count === 1 ? '' : 's'}. See output for details.`);
                        } else {
                            vscode.window.showInformationMessage('No security issues detected.');
                        }
                    });
                } catch (error) {
                    Logger.error('Failed to scan security', error);
                    vscode.window.showErrorMessage('Failed to scan for security issues. Check output for details.');
                }
            }),
            vscode.commands.registerCommand('bunnyai.explainSecurityIssues', async () => {
                try {
                    if (!lastSecurityScanResult || lastSecurityScanResult.issues.length === 0) {
                        vscode.window.showWarningMessage('No security scan results available. Run "Security Scan File" first.');
                        return;
                    }

                    const editor = vscode.window.activeTextEditor;
                    if (!editor) {
                        vscode.window.showWarningMessage('No active editor.');
                        return;
                    }

                    const document = editor.document;
                    const code = document.getText();
                    const scanResult = lastSecurityScanResult; // Store in local variable for type safety

                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: 'Analyzing Security Issues with AI',
                        cancellable: false
                    }, async (progress) => {
                        progress.report({ increment: 0, message: 'Preparing analysis...' });

                        try {
                            const aiProvider = new AIProvider();
                            const issuesText = scanResult.issues.map((issue, idx) => {
                                const lines = code.split('\n');
                                const startLine = Math.max(0, issue.line - 3);
                                const endLine = Math.min(lines.length, issue.line + 2);
                                const context = lines.slice(startLine, endLine).join('\n');
                                return `Issue ${idx + 1} (Line ${issue.line}, ${issue.severity} severity):
Rule: ${issue.ruleId}
Message: ${issue.message}
Code context:
\`\`\`
${context}
\`\`\``;
                            }).join('\n\n');

                            const prompt = `Analyze the following security issues found in code and provide:
1. Severity justification (why is this high/medium/low risk?)
2. Risk explanation (what could happen if this is exploited?)
3. Suggested fix (how to remediate this issue)

Security Issues:
${issuesText}

Provide a clear, actionable analysis for each issue.`;

                            progress.report({ increment: 50, message: 'Requesting AI analysis...' });
                            const explanation = await aiProvider.explainSecurityIssues(prompt);

                            // Show explanation in a new document
                            const doc = await vscode.workspace.openTextDocument({
                                content: explanation,
                                language: 'markdown'
                            });
                            await vscode.window.showTextDocument(doc);

                            vscode.window.showInformationMessage('Security analysis complete!');
                        } catch (error: any) {
                            if (error.message && error.message.includes('AI API key')) {
                                vscode.window.showErrorMessage('AI API key not configured. Use "BunnyAI: Configure AI API Key" to set it up.');
                            } else {
                                vscode.window.showErrorMessage(`Failed to analyze security issues: ${error.message}`);
                            }
                            throw error;
                        }
                    });
                } catch (error) {
                    Logger.error('Failed to explain security issues', error);
                    vscode.window.showErrorMessage('Failed to explain security issues. Check output for details.');
                }
            })
        );

        Logger.log('BunnyAI Pro activated successfully!');
    } catch (error) {
        Logger.error('Failed to activate BunnyAI Pro', error);
        vscode.window.showErrorMessage('BunnyAI Pro failed to activate. Check output for details.');
    }
}

function renderQualityReport(report: FileQualityReport) {
    if (!codeQualityChannel) {
        return;
    }
    codeQualityChannel.clear();
    codeQualityChannel.appendLine(`BunnyAI Code Quality Report: ${report.filePath}`);
    codeQualityChannel.appendLine(`Functions analyzed: ${report.functions.length}`);
    codeQualityChannel.appendLine(`Average Cyclomatic Complexity: ${report.summary.avgCyclomatic}`);
    codeQualityChannel.appendLine(`Max Cyclomatic Complexity: ${report.summary.maxCyclomatic}`);
    if (report.summary.worstFunction) {
        codeQualityChannel.appendLine(`Worst Function: ${report.summary.worstFunction}`);
    }
    codeQualityChannel.appendLine('');
    codeQualityChannel.appendLine(
        ['Function', 'Cyclomatic', 'LOC', 'Nesting', 'Grade']
            .map((h) => h.padEnd(15))
            .join('')
    );
    codeQualityChannel.appendLine('-'.repeat(75));
    report.functions.forEach((func) => {
        const row = [
            func.name,
            func.cyclomatic.toString(),
            func.loc.toString(),
            func.nestingDepth.toString(),
            func.maintainability
        ]
            .map((val) => val.padEnd(15))
            .join('');
        codeQualityChannel?.appendLine(row);
    });
    codeQualityChannel.show(true);
}

function renderTextReview(review: string) {
    if (!codeQualityChannel) {
        codeQualityChannel = vscode.window.createOutputChannel('BunnyAI Code Quality');
    }
    codeQualityChannel.clear();
    codeQualityChannel.appendLine('BunnyAI Review');
    codeQualityChannel.appendLine('--------------');
    codeQualityChannel.appendLine(review.trim());
    codeQualityChannel.show(true);
}

function applyDiagnosticsAndDecorations(editor: vscode.TextEditor, functions: FunctionMetric[]) {
    if (!codeQualityDiagnostics || !codeQualityWarningDecoration || !codeQualityErrorDecoration) {
        return;
    }

    const diagnostics: vscode.Diagnostic[] = [];
    const warningDecorations: vscode.DecorationOptions[] = [];
    const errorDecorations: vscode.DecorationOptions[] = [];

    const document = editor.document;

    const getSeverity = (metric: FunctionMetric): vscode.DiagnosticSeverity | undefined => {
        if (
            metric.cyclomatic >= 12 ||
            ['E', 'F'].includes(metric.maintainability) ||
            metric.nestingDepth >= 5 ||
            metric.loc >= 100
        ) {
            return vscode.DiagnosticSeverity.Error;
        }
        if (
            metric.cyclomatic >= 8 ||
            ['C', 'D'].includes(metric.maintainability) ||
            metric.nestingDepth >= 4 ||
            metric.loc >= 80
        ) {
            return vscode.DiagnosticSeverity.Warning;
        }
        return undefined;
    };

    functions.forEach((metric) => {
        const startLine = Math.max(metric.startLine - 1, 0);
        const endLine = Math.min(metric.endLine - 1, document.lineCount - 1);
        const start = new vscode.Position(startLine, 0);
        const end = new vscode.Position(endLine, document.lineAt(endLine).range.end.character);
        const range = new vscode.Range(start, end);

        const severity = getSeverity(metric);
        if (severity !== undefined) {
            const message = `Complexity ${metric.cyclomatic}, LOC ${metric.loc}, nesting ${metric.nestingDepth}, grade ${metric.maintainability}`;
            diagnostics.push(new vscode.Diagnostic(range, message, severity));
            const target = severity === vscode.DiagnosticSeverity.Error ? errorDecorations : warningDecorations;
            target.push({
                range,
                hoverMessage: message
            });
        }
    });

    codeQualityDiagnostics.set(document.uri, diagnostics);
    editor.setDecorations(codeQualityWarningDecoration, warningDecorations);
    editor.setDecorations(codeQualityErrorDecoration, errorDecorations);
}

function updateCodeQualityStatus(functions: FunctionMetric[]) {
    if (!statusBarItem || functions.length === 0) {
        return;
    }
    const gradeOrder: Record<FunctionMetric['maintainability'], number> = {
        A: 1,
        B: 2,
        C: 3,
        D: 4,
        E: 5,
        F: 6
    };
    const worst = functions.reduce((prev, curr) => (gradeOrder[curr.maintainability] > gradeOrder[prev.maintainability] ? curr : prev), functions[0]);
    statusBarItem.text = `$(bunny) BunnyAI (CQ: ${worst.maintainability})`;
    const gradeInfo = `Worst maintainability grade ${worst.maintainability}, max cyclomatic ${worst.cyclomatic}`;
    statusBarItem.tooltip = `BunnyAI Pro - ${statusBarBaseTooltip} | ${gradeInfo}`;
}

function parseReviewAndRefactor(response: string): { review: string; refactor: string } {
    const reviewMatch = response.match(/\[REVIEW\]([\s\S]*?)\[\/REVIEW\]/i);
    const refactorMatch = response.match(/\[REFACTOR\]([\s\S]*?)\[\/REFACTOR\]/i);

    const review = reviewMatch ? reviewMatch[1].trim() : '';
    let refactor = refactorMatch ? refactorMatch[1].trim() : '';

    if (!refactor) {
        // Fallback: try to extract the last fenced code block
        const codeBlockMatch = response.match(/```[a-zA-Z0-9]*\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
            refactor = codeBlockMatch[1].trim();
        } else {
            refactor = response.trim();
        }
    }

    return { review, refactor };
}

export function deactivate() {
    try {
        if (statusBarItem) {
            statusBarItem.dispose();
        }
        const core = ExtensionCore.getInstance();
        core.deactivate();
    } catch (error) {
        // Extension might not be initialized, ignore error
        Logger.log('Extension already deactivated or not initialized');
    }
}
