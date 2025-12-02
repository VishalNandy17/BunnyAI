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

let statusBarItem: vscode.StatusBarItem;

export async function activate(context: vscode.ExtensionContext) {
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
        statusBarItem.tooltip = `BunnyAI Pro - Framework: ${frameworkInfo.framework}`;
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

        // Register commands with error handling
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
            })
        );

        Logger.log('BunnyAI Pro activated successfully!');
    } catch (error) {
        Logger.error('Failed to activate BunnyAI Pro', error);
        vscode.window.showErrorMessage('BunnyAI Pro failed to activate. Check output for details.');
    }
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
