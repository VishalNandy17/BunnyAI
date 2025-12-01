import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { CodeLensProvider } from '../providers/CodeLensProvider';
import { WebviewManager } from '../webview/WebviewManager';
import { HistoryTreeProvider } from '../providers/HistoryTreeProvider';
import { CollectionProvider } from '../providers/CollectionProvider';
import { RouteTreeDataProvider } from '../providers/RouteTreeDataProvider';

export class ExtensionCore {
    private static instance: ExtensionCore;
    private context: vscode.ExtensionContext;
    private codeLensProvider: CodeLensProvider;
    private historyTreeProvider: HistoryTreeProvider;
    private collectionProvider: CollectionProvider;
    private routeTreeProvider: RouteTreeDataProvider;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.codeLensProvider = new CodeLensProvider();
        this.historyTreeProvider = new HistoryTreeProvider();
        this.collectionProvider = new CollectionProvider();
        this.routeTreeProvider = new RouteTreeDataProvider();
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
        try {
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

            // Register Tree Data Providers
            this.context.subscriptions.push(
                vscode.window.createTreeView('bunnyai.views.history', {
                    treeDataProvider: this.historyTreeProvider
                }),
                vscode.window.createTreeView('bunnyai.views.collections', {
                    treeDataProvider: this.collectionProvider
                }),
                vscode.window.createTreeView('bunnyai.views.requests', {
                    treeDataProvider: this.routeTreeProvider
                })
            );

            // Refresh tree views when document changes
            this.context.subscriptions.push(
                vscode.workspace.onDidChangeTextDocument(() => {
                    this.routeTreeProvider.refresh();
                }),
                vscode.window.onDidChangeActiveTextEditor(() => {
                    this.routeTreeProvider.refresh();
                })
            );

            Logger.log('BunnyAI Pro activated successfully!');
        } catch (error) {
            Logger.error('Failed to activate ExtensionCore', error);
            throw error;
        }
    }

    public getHistoryTreeProvider(): HistoryTreeProvider {
        return this.historyTreeProvider;
    }

    public getCollectionProvider(): CollectionProvider {
        return this.collectionProvider;
    }

    public deactivate() {
        Logger.log('BunnyAI Pro deactivating...');
    }
}
