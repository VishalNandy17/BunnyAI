import * as vscode from 'vscode';
import { IRoute } from '../types';
import { ExpressParser } from '../parsers/ExpressParser';
import { Logger } from '../utils/logger';

export class RouteTreeDataProvider implements vscode.TreeDataProvider<RouteTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<RouteTreeItem | undefined | null | void> = new vscode.EventEmitter<RouteTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<RouteTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private parser: ExpressParser;
    private routes: IRoute[] = [];

    constructor() {
        this.parser = new ExpressParser();
        this.refresh();
    }

    refresh(): void {
        this.updateRoutes();
        this._onDidChangeTreeData.fire();
    }

    private async updateRoutes(): Promise<void> {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                this.routes = [];
                return;
            }

            const document = editor.document;
            if (this.parser.supports(document.languageId)) {
                const content = document.getText();
                this.routes = await this.parser.parse(content);
            } else {
                this.routes = [];
            }
        } catch (error) {
            Logger.error('Error updating routes', error);
            this.routes = [];
        }
    }

    getTreeItem(element: RouteTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: RouteTreeItem): Promise<RouteTreeItem[]> {
        if (!element) {
            // Root level - show all routes
            return this.routes.map(route => {
                const item = new RouteTreeItem(
                    `${route.method} ${route.path}`,
                    vscode.TreeItemCollapsibleState.None,
                    route
                );
                item.tooltip = `Line ${route.line + 1}: ${route.handler}`;
                item.command = {
                    command: 'bunnyai.runApi',
                    title: 'Run API',
                    arguments: [route]
                };
                item.contextValue = 'route';
                return item;
            });
        }
        return [];
    }
}

class RouteTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly route: IRoute
    ) {
        super(label, collapsibleState);
    }
}
