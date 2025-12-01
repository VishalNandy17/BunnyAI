import * as vscode from 'vscode';
import { CollectionManager, Collection } from '../core/CollectionManager';
import { Logger } from '../utils/logger';

export class CollectionProvider implements vscode.TreeDataProvider<CollectionTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<CollectionTreeItem | undefined | null | void> = new vscode.EventEmitter<CollectionTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<CollectionTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private collectionManager: CollectionManager;

    constructor() {
        this.collectionManager = CollectionManager.getInstance();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: CollectionTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: CollectionTreeItem): Promise<CollectionTreeItem[]> {
        try {
            if (!element) {
                // Root level - show collections
                const collections = await this.collectionManager.getAllCollections();
                return collections.map(collection => {
                    const item = new CollectionTreeItem(
                        collection.name,
                        vscode.TreeItemCollapsibleState.Collapsed,
                        collection
                    );
                    item.description = `${collection.requests.length} requests`;
                    item.tooltip = collection.description || collection.name;
                    item.contextValue = 'collection';
                    return item;
                });
            } else {
                // Show requests in collection
                const collection = element.collection;
                return collection.requests.map(request => {
                    const item = new CollectionTreeItem(
                        `${request.method} ${request.url}`,
                        vscode.TreeItemCollapsibleState.None,
                        collection,
                        request
                    );
                    item.command = {
                        command: 'bunnyai.runApi',
                        title: 'Run Request',
                        arguments: [{ method: request.method, path: request.url }]
                    };
                    item.contextValue = 'collectionRequest';
                    return item;
                });
            }
        } catch (error) {
            Logger.error('Error getting collection tree items', error);
            return [];
        }
    }
}

class CollectionTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly collection: Collection,
        public readonly request?: any
    ) {
        super(label, collapsibleState);
    }
}
