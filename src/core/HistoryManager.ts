import { IRequest, IResponse } from '../types';
import { WorkspaceStorage } from '../storage/WorkspaceStorage';
import { Logger } from '../utils/logger';

export interface HistoryEntry {
    id: string;
    request: IRequest;
    response: IResponse;
    timestamp: number;
}

export class HistoryManager {
    private static instance: HistoryManager;
    private storage: WorkspaceStorage;
    private history: HistoryEntry[] = [];
    private readonly maxHistorySize = 100;

    private constructor() {
        this.storage = WorkspaceStorage.getInstance();
        this.loadHistory();
    }

    public static getInstance(): HistoryManager {
        if (!HistoryManager.instance) {
            HistoryManager.instance = new HistoryManager();
        }
        return HistoryManager.instance;
    }

    public static initialize(storage: WorkspaceStorage): void {
        // This will be called during extension activation
    }

    private async loadHistory(): Promise<void> {
        try {
            const data = await this.storage.get('requestHistory');
            if (data) {
                this.history = JSON.parse(data);
                // Limit history size
                if (this.history.length > this.maxHistorySize) {
                    this.history = this.history.slice(-this.maxHistorySize);
                }
            }
        } catch (error) {
            Logger.error('Failed to load history', error);
            this.history = [];
        }
    }

    private async saveHistory(): Promise<void> {
        try {
            await this.storage.set('requestHistory', JSON.stringify(this.history));
        } catch (error) {
            Logger.error('Failed to save history', error);
        }
    }

    async addRequest(request: IRequest, response: IResponse): Promise<void> {
        try {
            const entry: HistoryEntry = {
                id: request.id || this.generateId(),
                request,
                response,
                timestamp: Date.now()
            };

            this.history.push(entry);

            // Limit history size
            if (this.history.length > this.maxHistorySize) {
                this.history = this.history.slice(-this.maxHistorySize);
            }

            await this.saveHistory();
            Logger.log(`Added request to history: ${request.method} ${request.url}`);
        } catch (error) {
            Logger.error('Failed to add request to history', error);
        }
    }

    async getHistory(): Promise<HistoryEntry[]> {
        return [...this.history];
    }

    async getHistoryEntry(id: string): Promise<HistoryEntry | undefined> {
        return this.history.find(entry => entry.id === id);
    }

    async clearHistory(): Promise<void> {
        this.history = [];
        await this.saveHistory();
        Logger.log('History cleared');
    }

    async removeHistoryEntry(id: string): Promise<void> {
        this.history = this.history.filter(entry => entry.id !== id);
        await this.saveHistory();
    }

    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    addToHistory(item: any): void {
        // Legacy method for compatibility
        if (item.request && item.response) {
            this.addRequest(item.request, item.response);
        }
    }
}
