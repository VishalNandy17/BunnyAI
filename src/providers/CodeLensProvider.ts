import * as vscode from 'vscode';
import { ExpressParser } from '../parsers/ExpressParser';
import { IRoute } from '../types';
import { Logger } from '../utils/logger';
import { ConfigManager } from '../core/ConfigManager';

interface CachedRoutes {
    routes: IRoute[];
    timestamp: number;
    contentHash: string;
}

export class CodeLensProvider implements vscode.CodeLensProvider {
    private parser: ExpressParser;
    private configManager: ConfigManager;
    private cache: Map<string, CachedRoutes> = new Map();
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
    private readonly CACHE_TTL = 5000; // 5 seconds
    private readonly DEBOUNCE_DELAY = 300; // 300ms

    constructor() {
        this.parser = new ExpressParser();
        this.configManager = ConfigManager.getInstance();
    }

    async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.CodeLens[]> {
        try {
            // Check if CodeLens is enabled
            if (!this.configManager.isCodeLensEnabled()) {
                return [];
            }

            if (!this.parser.supports(document.languageId)) {
                return [];
            }

            // Check for cancellation
            if (token.isCancellationRequested) {
                return [];
            }

            // Get cached routes if available
            const cacheKey = document.uri.toString();
            const contentHash = this.hashContent(document.getText());
            const cached = this.cache.get(cacheKey);

            if (cached && cached.contentHash === contentHash) {
                const age = Date.now() - cached.timestamp;
                if (age < this.CACHE_TTL) {
                    Logger.log(`Using cached routes for ${document.fileName}`);
                    return this.createCodeLenses(cached.routes);
                }
            }

            // Debounce parsing for performance
            return new Promise((resolve) => {
                const existingTimer = this.debounceTimers.get(cacheKey);
                if (existingTimer) {
                    clearTimeout(existingTimer);
                }

                const timer = setTimeout(async () => {
                    this.debounceTimers.delete(cacheKey);
                    
                    try {
                        if (token.isCancellationRequested) {
                            resolve([]);
                            return;
                        }

                        const text = document.getText();
                        const routes = await this.parser.parse(text);
                        
                        // Check for cancellation again after parsing
                        if (token.isCancellationRequested) {
                            resolve([]);
                            return;
                        }

                        // Cache the results
                        this.cache.set(cacheKey, {
                            routes,
                            timestamp: Date.now(),
                            contentHash
                        });

                        resolve(this.createCodeLenses(routes));
                    } catch (error) {
                        Logger.error('Error parsing routes', error);
                        resolve([]);
                    }
                }, this.DEBOUNCE_DELAY);

                this.debounceTimers.set(cacheKey, timer);
            });

        } catch (error) {
            Logger.error('Error providing CodeLens', error);
            return [];
        }
    }

    private createCodeLenses(routes: IRoute[]): vscode.CodeLens[] {
        const lenses: vscode.CodeLens[] = [];

        for (const route of routes) {
            const range = new vscode.Range(route.line, 0, route.line, 0);
            const command: vscode.Command = {
                title: `$(play) Run ${route.method} ${route.path}`,
                command: 'bunnyai.runApi',
                arguments: [route]
            };
            lenses.push(new vscode.CodeLens(range, command));
        }

        return lenses;
    }

    private hashContent(content: string): string {
        // Simple hash function for content comparison
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }

    clearCache(): void {
        this.cache.clear();
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
    }
}
