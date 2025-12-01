import { IResponse } from '../types';
import { Logger } from '../utils/logger';

interface CacheEntry {
    response: IResponse;
    timestamp: number;
    ttl: number; // Time to live in milliseconds
}

export class CacheMiddleware {
    private cache: Map<string, CacheEntry> = new Map();
    private defaultTTL: number = 5 * 60 * 1000; // 5 minutes

    async get(url: string): Promise<IResponse | null> {
        const entry = this.cache.get(url);
        
        if (!entry) {
            return null;
        }

        // Check if cache entry is expired
        const now = Date.now();
        if (now - entry.timestamp > entry.ttl) {
            this.cache.delete(url);
            return null;
        }

        Logger.log(`Cache hit for ${url}`);
        return entry.response;
    }

    async set(url: string, response: IResponse, ttl?: number): Promise<void> {
        const entry: CacheEntry = {
            response,
            timestamp: Date.now(),
            ttl: ttl || this.defaultTTL
        };

        this.cache.set(url, entry);
        Logger.log(`Cached response for ${url}`);
    }

    clear(): void {
        this.cache.clear();
        Logger.log('Cache cleared');
    }

    remove(url: string): void {
        this.cache.delete(url);
    }

    setDefaultTTL(ttl: number): void {
        this.defaultTTL = ttl;
    }

    getSize(): number {
        return this.cache.size;
    }
}
