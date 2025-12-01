import * as vscode from 'vscode';
import { RequestPanel } from './panels/RequestPanel';

export class WebviewManager {
    private static instance: WebviewManager;
    private context: vscode.ExtensionContext;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    public static initialize(context: vscode.ExtensionContext): WebviewManager {
        if (!WebviewManager.instance) {
            WebviewManager.instance = new WebviewManager(context);
        }
        return WebviewManager.instance;
    }

    public static getInstance(): WebviewManager {
        return WebviewManager.instance;
    }

    public openRequestPanel(route?: any) {
        RequestPanel.createOrShow(this.context.extensionUri, route);
    }
}
