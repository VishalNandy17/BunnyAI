import { WorkspaceStorage } from '../storage/WorkspaceStorage';
import { Logger } from '../utils/logger';
import { ConfigManager } from './ConfigManager';

export interface Environment {
    name: string;
    baseUrl?: string;
    apiKey?: string;
    headers?: Record<string, string>;
    variables?: Record<string, string>;
}

export class EnvironmentManager {
    private static instance: EnvironmentManager;
    private storage: WorkspaceStorage;
    private configManager: ConfigManager;
    private environments: Map<string, Environment> = new Map();
    private activeEnvironmentName: string | null = null;

    private constructor() {
        this.storage = WorkspaceStorage.getInstance();
        this.configManager = ConfigManager.getInstance();
        this.loadEnvironments();
    }

    public static getInstance(): EnvironmentManager {
        if (!EnvironmentManager.instance) {
            EnvironmentManager.instance = new EnvironmentManager();
        }
        return EnvironmentManager.instance;
    }

    private async loadEnvironments(): Promise<void> {
        try {
            const data = await this.storage.get('environments');
            if (data) {
                this.environments = new Map(JSON.parse(data));
            }

            const active = await this.storage.get('activeEnvironment');
            if (active) {
                this.activeEnvironmentName = active;
            }
        } catch (error) {
            Logger.error('Failed to load environments', error);
        }
    }

    async saveEnvironments(): Promise<void> {
        try {
            const data = JSON.stringify(Array.from(this.environments.entries()));
            await this.storage.set('environments', data);
            
            if (this.activeEnvironmentName) {
                await this.storage.set('activeEnvironment', this.activeEnvironmentName);
            }
        } catch (error) {
            Logger.error('Failed to save environments', error);
        }
    }

    async addEnvironment(env: Environment): Promise<void> {
        this.environments.set(env.name, env);
        await this.saveEnvironments();
    }

    async removeEnvironment(name: string): Promise<void> {
        this.environments.delete(name);
        if (this.activeEnvironmentName === name) {
            this.activeEnvironmentName = null;
        }
        await this.saveEnvironments();
    }

    async getEnvironment(name: string): Promise<Environment | undefined> {
        return this.environments.get(name);
    }

    async getAllEnvironments(): Promise<Environment[]> {
        return Array.from(this.environments.values());
    }

    async setActiveEnvironment(name: string | null): Promise<void> {
        this.activeEnvironmentName = name;
        await this.saveEnvironments();
    }

    async getActiveEnvironment(): Promise<Environment | null> {
        if (!this.activeEnvironmentName) {
            return null;
        }
        return this.environments.get(this.activeEnvironmentName) || null;
    }

    get(key: string): string | undefined {
        // Get from active environment variables
        if (this.activeEnvironmentName) {
            const env = this.environments.get(this.activeEnvironmentName);
            return env?.variables?.[key];
        }
        return undefined;
    }

    set(key: string, value: string): void {
        if (this.activeEnvironmentName) {
            const env = this.environments.get(this.activeEnvironmentName);
            if (env) {
                if (!env.variables) {
                    env.variables = {};
                }
                env.variables[key] = value;
                this.saveEnvironments();
            }
        }
    }
}
