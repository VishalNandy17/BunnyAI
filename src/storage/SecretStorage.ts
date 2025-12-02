import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

/**
 * Wrapper around VS Code SecretStorage.
 *
 * Call `SecretStorage.initialize(context)` once during activation,
 * then use `SecretStorage.getInstance()` wherever secrets are needed.
 */
export class SecretStorage {
    private static instance: SecretStorage;
    private readonly secrets: vscode.SecretStorage;

    private constructor(secretStorage: vscode.SecretStorage) {
        this.secrets = secretStorage;
    }

    public static initialize(context: vscode.ExtensionContext): SecretStorage {
        if (!SecretStorage.instance) {
            SecretStorage.instance = new SecretStorage(context.secrets);
            Logger.log('SecretStorage initialized');
        }
        return SecretStorage.instance;
    }

    public static getInstance(): SecretStorage {
        if (!SecretStorage.instance) {
            throw new Error('SecretStorage not initialized. Call SecretStorage.initialize() first.');
        }
        return SecretStorage.instance;
    }

    async get(key: string): Promise<string | undefined> {
        try {
            return await this.secrets.get(key);
        } catch (error) {
            Logger.error(`Failed to read secret: ${key}`, error);
            return undefined;
        }
    }

    async set(key: string, value: string): Promise<void> {
        try {
            await this.secrets.store(key, value);
        } catch (error) {
            Logger.error(`Failed to store secret: ${key}`, error);
            throw error;
        }
    }

    async delete(key: string): Promise<void> {
        try {
            await this.secrets.delete(key);
        } catch (error) {
            Logger.error(`Failed to delete secret: ${key}`, error);
            throw error;
        }
    }
}
