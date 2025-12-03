import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

export interface ExtensionConfig {
    baseUrl?: string;
    defaultTimeout?: number;
    enableCache?: boolean;
    cacheTTL?: number;
    maxRetries?: number;
    retryDelay?: number;
    aiProvider?: 'openai' | 'anthropic' | 'custom';
    aiApiKey?: string;
    aiModel?: string;
    autoDetectFramework?: boolean;
    enableCodeLens?: boolean;
    maxRequestBodySize?: number;
    maxResponseSize?: number;
    enableSecurityScanning?: boolean;
    enableWorkspaceScanning?: boolean;
    maxWorkspaceFiles?: number;
    highComplexityThreshold?: number;
    criticalComplexityThreshold?: number;
}

export class ConfigManager {
    private static instance: ConfigManager;
    private config: vscode.WorkspaceConfiguration;
    private _onDidChangeConfiguration: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeConfiguration: vscode.Event<void> = this._onDidChangeConfiguration.event;

    private constructor() {
        this.config = vscode.workspace.getConfiguration('bunnyai');
        this.setupConfigurationWatcher();
    }

    public static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }

    private setupConfigurationWatcher(): void {
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('bunnyai')) {
                this.config = vscode.workspace.getConfiguration('bunnyai');
                this._onDidChangeConfiguration.fire();
                Logger.log('Configuration changed');
            }
        });
    }

    getConfig(): ExtensionConfig {
        return {
            baseUrl: this.config.get<string>('baseUrl'),
            defaultTimeout: this.config.get<number>('defaultTimeout', 30000),
            enableCache: this.config.get<boolean>('enableCache', true),
            cacheTTL: this.config.get<number>('cacheTTL', 300000), // 5 minutes
            maxRetries: this.config.get<number>('maxRetries', 3),
            retryDelay: this.config.get<number>('retryDelay', 1000),
            aiProvider: this.config.get<'openai' | 'anthropic' | 'custom'>('aiProvider', 'openai'),
            aiApiKey: this.config.get<string>('aiApiKey'),
            aiModel: this.config.get<string>('aiModel'),
            autoDetectFramework: this.config.get<boolean>('autoDetectFramework', true),
            enableCodeLens: this.config.get<boolean>('enableCodeLens', true),
            maxRequestBodySize: this.config.get<number>('maxRequestBodySize', 1024 * 1024), // 1 MB
            maxResponseSize: this.config.get<number>('maxResponseSize', 10 * 1024 * 1024), // 10 MB
            enableSecurityScanning: this.config.get<boolean>('enableSecurityScanning', true),
            enableWorkspaceScanning: this.config.get<boolean>('enableWorkspaceScanning', true),
            maxWorkspaceFiles: this.config.get<number>('maxWorkspaceFiles', 10000),
            highComplexityThreshold: this.config.get<number>('highComplexityThreshold', 10),
            criticalComplexityThreshold: this.config.get<number>('criticalComplexityThreshold', 20)
        };
    }

    get<T>(key: string, defaultValue?: T): T | undefined {
        if (defaultValue !== undefined) {
            return this.config.get<T>(key, defaultValue);
        }
        return this.config.get<T>(key);
    }

    async update(key: string, value: any, target?: vscode.ConfigurationTarget): Promise<void> {
        try {
            await this.config.update(key, value, target || vscode.ConfigurationTarget.Workspace);
            Logger.log(`Configuration updated: ${key} = ${value}`);
        } catch (error) {
            Logger.error(`Failed to update configuration: ${key}`, error);
            throw error;
        }
    }

    getBaseUrl(): string | undefined {
        return this.getConfig().baseUrl;
    }

    getDefaultTimeout(): number {
        return this.getConfig().defaultTimeout || 30000;
    }

    isCacheEnabled(): boolean {
        return this.getConfig().enableCache !== false;
    }

    getCacheTTL(): number {
        return this.getConfig().cacheTTL || 300000;
    }

    getMaxRetries(): number {
        return this.getConfig().maxRetries || 3;
    }

    getRetryDelay(): number {
        return this.getConfig().retryDelay || 1000;
    }

    getAIProvider(): 'openai' | 'anthropic' | 'custom' {
        return this.getConfig().aiProvider || 'openai';
    }

    getAIApiKey(): string | undefined {
        return this.getConfig().aiApiKey;
    }

    getAIModel(): string | undefined {
        return this.getConfig().aiModel;
    }

    shouldAutoDetectFramework(): boolean {
        return this.getConfig().autoDetectFramework !== false;
    }

    isCodeLensEnabled(): boolean {
        return this.getConfig().enableCodeLens !== false;
    }

    getMaxRequestBodySize(): number {
        return this.getConfig().maxRequestBodySize || 1024 * 1024;
    }

    getMaxResponseSize(): number {
        return this.getConfig().maxResponseSize || 10 * 1024 * 1024;
    }

    isSecurityScanningEnabled(): boolean {
        return this.getConfig().enableSecurityScanning !== false;
    }

    isWorkspaceScanningEnabled(): boolean {
        return this.getConfig().enableWorkspaceScanning !== false;
    }

    getMaxWorkspaceFiles(): number {
        return this.getConfig().maxWorkspaceFiles || 10000;
    }

    getHighComplexityThreshold(): number {
        return this.getConfig().highComplexityThreshold || 10;
    }

    getCriticalComplexityThreshold(): number {
        return this.getConfig().criticalComplexityThreshold || 20;
    }
}

