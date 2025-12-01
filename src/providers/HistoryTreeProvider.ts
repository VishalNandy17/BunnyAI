import * as vscode from 'vscode';
import { HistoryManager, HistoryEntry } from '../core/HistoryManager';
import { Logger } from '../utils/logger';

export class HistoryTreeProvider implements vscode.TreeDataProvider<HistoryTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<HistoryTreeItem | undefined | null | void> = new vscode.EventEmitter<HistoryTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<HistoryTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private historyManager: HistoryManager;

    constructor() {
        this.historyManager = HistoryManager.getInstance();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: HistoryTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: HistoryTreeItem): Promise<HistoryTreeItem[]> {
        try {
            if (!element) {
                // Root level - show history entries
                const history = await this.historyManager.getHistory();
                return history.map(entry => {
                    const status = entry.response.status;
                    const statusIcon = status >= 200 && status < 300 ? '$(check)' : 
                                     status >= 400 && status < 500 ? '$(warning)' : 
                                     status >= 500 ? '$(error)' : '$(question)';
                    
                    const label = `${statusIcon} ${entry.request.method} ${entry.request.url}`;
                    const item = new HistoryTreeItem(
                        label,
                        vscode.TreeItemCollapsibleState.None,
                        entry
                    );
                    item.tooltip = `Status: ${status} | Duration: ${entry.response.duration}ms | ${new Date(entry.timestamp).toLocaleString()}`;
                    item.command = {
                        command: 'bunnyai.viewHistoryEntry',
                        title: 'View History Entry',
                        arguments: [entry]
                    };
                    return item;
                }).reverse(); // Show most recent first
            }
            return [];
        } catch (error) {
            Logger.error('Error getting history tree items', error);
            return [];
        }
    }
}

class HistoryTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly entry: HistoryEntry
    ) {
        super(label, collapsibleState);
        this.contextValue = 'historyEntry';
    }
}
