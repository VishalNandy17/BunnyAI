import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

export class WorkspaceStorage {
    private static instance: WorkspaceStorage;
    private context: vscode.ExtensionContext;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    public static initialize(context: vscode.ExtensionContext): WorkspaceStorage {
        if (!WorkspaceStorage.instance) {
            WorkspaceStorage.instance = new WorkspaceStorage(context);
        }
        return WorkspaceStorage.instance;
    }

    public static getInstance(): WorkspaceStorage {
        if (!WorkspaceStorage.instance) {
            throw new Error('WorkspaceStorage not initialized. Call initialize() first.');
        }
        return WorkspaceStorage.instance;
    }

    async get(key: string): Promise<string | undefined> {
        try {
            return await this.context.workspaceState.get(key);
        } catch (error) {
            Logger.error(`Failed to get workspace storage key: ${key}`, error);
            return undefined;
        }
    }

    async set(key: string, value: string): Promise<void> {
        try {
            await this.context.workspaceState.update(key, value);
        } catch (error) {
            Logger.error(`Failed to set workspace storage key: ${key}`, error);
        }
    }

    async delete(key: string): Promise<void> {
        try {
            await this.context.workspaceState.update(key, undefined);
        } catch (error) {
            Logger.error(`Failed to delete workspace storage key: ${key}`, error);
        }
    }

    save(key: string, value: any): void {
        this.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
}
