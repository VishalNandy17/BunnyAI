import { IRequest } from '../types';
import { WorkspaceStorage } from '../storage/WorkspaceStorage';
import { Logger } from '../utils/logger';

export interface Collection {
    id: string;
    name: string;
    description?: string;
    requests: IRequest[];
    createdAt: number;
    updatedAt: number;
}

export class CollectionManager {
    private static instance: CollectionManager;
    private storage: WorkspaceStorage;
    private collections: Map<string, Collection> = new Map();

    private constructor() {
        this.storage = WorkspaceStorage.getInstance();
        this.loadCollections();
    }

    public static getInstance(): CollectionManager {
        if (!CollectionManager.instance) {
            CollectionManager.instance = new CollectionManager();
        }
        return CollectionManager.instance;
    }

    private async loadCollections(): Promise<void> {
        try {
            const data = await this.storage.get('collections');
            if (data) {
                const collectionsArray = JSON.parse(data) as Collection[];
                this.collections = new Map(collectionsArray.map(c => [c.id, c]));
            }
        } catch (error) {
            Logger.error('Failed to load collections', error);
            this.collections = new Map();
        }
    }

    private async saveCollections(): Promise<void> {
        try {
            const collectionsArray = Array.from(this.collections.values());
            await this.storage.set('collections', JSON.stringify(collectionsArray));
        } catch (error) {
            Logger.error('Failed to save collections', error);
        }
    }

    async createCollection(name: string, description?: string): Promise<Collection> {
        const collection: Collection = {
            id: this.generateId(),
            name,
            description,
            requests: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        this.collections.set(collection.id, collection);
        await this.saveCollections();
        Logger.log(`Created collection: ${name}`);
        return collection;
    }

    async getCollection(id: string): Promise<Collection | undefined> {
        return this.collections.get(id);
    }

    async getAllCollections(): Promise<Collection[]> {
        return Array.from(this.collections.values());
    }

    async updateCollection(id: string, updates: Partial<Collection>): Promise<void> {
        const collection = this.collections.get(id);
        if (!collection) {
            throw new Error(`Collection ${id} not found`);
        }

        Object.assign(collection, updates, { updatedAt: Date.now() });
        await this.saveCollections();
        Logger.log(`Updated collection: ${collection.name}`);
    }

    async deleteCollection(id: string): Promise<void> {
        if (this.collections.delete(id)) {
            await this.saveCollections();
            Logger.log(`Deleted collection: ${id}`);
        }
    }

    async addRequestToCollection(collectionId: string, request: IRequest): Promise<void> {
        const collection = this.collections.get(collectionId);
        if (!collection) {
            throw new Error(`Collection ${collectionId} not found`);
        }

        collection.requests.push(request);
        collection.updatedAt = Date.now();
        await this.saveCollections();
        Logger.log(`Added request to collection: ${collection.name}`);
    }

    async removeRequestFromCollection(collectionId: string, requestId: string): Promise<void> {
        const collection = this.collections.get(collectionId);
        if (!collection) {
            throw new Error(`Collection ${collectionId} not found`);
        }

        collection.requests = collection.requests.filter(r => r.id !== requestId);
        collection.updatedAt = Date.now();
        await this.saveCollections();
    }

    async exportCollection(id: string): Promise<string> {
        const collection = this.collections.get(id);
        if (!collection) {
            throw new Error(`Collection ${id} not found`);
        }

        return JSON.stringify(collection, null, 2);
    }

    async importCollection(json: string): Promise<Collection> {
        try {
            const collection = JSON.parse(json) as Collection;
            
            // Validate collection structure
            if (!collection.name || !Array.isArray(collection.requests)) {
                throw new Error('Invalid collection format');
            }

            // Generate new ID to avoid conflicts
            collection.id = this.generateId();
            collection.createdAt = Date.now();
            collection.updatedAt = Date.now();

            this.collections.set(collection.id, collection);
            await this.saveCollections();
            Logger.log(`Imported collection: ${collection.name}`);
            return collection;
        } catch (error) {
            Logger.error('Failed to import collection', error);
            throw new Error('Failed to import collection: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    }

    async exportAllCollections(): Promise<string> {
        const collections = Array.from(this.collections.values());
        return JSON.stringify(collections, null, 2);
    }

    async importAllCollections(json: string): Promise<Collection[]> {
        try {
            const collections = JSON.parse(json) as Collection[];
            const imported: Collection[] = [];

            for (const collection of collections) {
                if (!collection.name || !Array.isArray(collection.requests)) {
                    Logger.log(`Skipping invalid collection: ${collection.name || 'unknown'}`);
                    continue;
                }

                collection.id = this.generateId();
                collection.createdAt = Date.now();
                collection.updatedAt = Date.now();
                this.collections.set(collection.id, collection);
                imported.push(collection);
            }

            await this.saveCollections();
            Logger.log(`Imported ${imported.length} collections`);
            return imported;
        } catch (error) {
            Logger.error('Failed to import collections', error);
            throw new Error('Failed to import collections: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    }

    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    addCollection(collection: any): void {
        // Legacy method for compatibility
        if (collection.name) {
            this.createCollection(collection.name, collection.description);
        }
    }
}
