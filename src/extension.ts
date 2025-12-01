import * as vscode from 'vscode';
import { ExtensionCore } from './core/ExtensionCore';
import { Logger } from './utils/logger';
import { WebviewManager } from './webview/WebviewManager';

export async function activate(context: vscode.ExtensionContext) {
    Logger.initialize('BunnyAI Pro');
    Logger.log('Activating BunnyAI Pro...');

    try {
        const core = ExtensionCore.initialize(context);
        await core.activate();

        // Register commands
        context.subscriptions.push(
            vscode.commands.registerCommand('bunnyai.runApi', (route) => {
                Logger.log(`Running API: ${route?.method} ${route?.path}`);
                WebviewManager.getInstance().openRequestPanel(route);
            }),
            vscode.commands.registerCommand('bunnyai.generateTests', () => {
                vscode.window.showInformationMessage('BunnyAI: Generate Tests command executed!');
            }),
            vscode.commands.registerCommand('bunnyai.analyzeError', () => {
                vscode.window.showInformationMessage('BunnyAI: Analyze Error command executed!');
            })
        );

    } catch (error) {
        Logger.error('Failed to activate BunnyAI Pro', error);
        vscode.window.showErrorMessage('BunnyAI Pro failed to activate. Check output for details.');
    }
}

export function deactivate() {
    ExtensionCore.getInstance().deactivate();
}
