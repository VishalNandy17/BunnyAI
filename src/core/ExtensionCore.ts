import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { CodeLensProvider } from '../providers/CodeLensProvider';
import { WebviewManager } from '../webview/WebviewManager';

export class ExtensionCore {
    private static instance: ExtensionCore;
    private context: vscode.ExtensionContext;
    private codeLensProvider: CodeLensProvider;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.codeLensProvider = new CodeLensProvider();
    }

    public static initialize(context: vscode.ExtensionContext): ExtensionCore {
        if (!ExtensionCore.instance) {
            ExtensionCore.instance = new ExtensionCore(context);
        }
        return ExtensionCore.instance;
    }

    public static getInstance(): ExtensionCore {
        if (!ExtensionCore.instance) {
            throw new Error('ExtensionCore not initialized');
        }
        return ExtensionCore.instance;
    }

    public async activate() {
        Logger.log('BunnyAI Pro activating...');

        // Initialize WebviewManager
        WebviewManager.initialize(this.context);

        // Register CodeLens Provider
        this.context.subscriptions.push(
            vscode.languages.registerCodeLensProvider(
                ['typescript', 'javascript'],
                this.codeLensProvider
            )
        );

        Logger.log('BunnyAI Pro activated successfully!');
    }

    public deactivate() {
        Logger.log('BunnyAI Pro deactivating...');
    }
}
