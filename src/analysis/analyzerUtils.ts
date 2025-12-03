import * as vscode from 'vscode';
import * as path from 'path';

export const SUPPORTED_LANGUAGES = [
    'typescript',
    'javascript',
    'typescriptreact',
    'javascriptreact'
];

export const DEFAULT_EXCLUDES = [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/coverage/**',
    '**/.vscode/**',
    '**/out/**',
    '**/*.min.js',
    '**/*.bundle.js'
];

/**
 * Get language ID from file URI
 */
export async function getLanguageId(uri: vscode.Uri): Promise<string> {
    const ext = path.extname(uri.fsPath).toLowerCase();
    const fileName = path.basename(uri.fsPath).toLowerCase();

    if (fileName.endsWith('.tsx') || ext === '.tsx') {
        return 'typescriptreact';
    }
    if (fileName.endsWith('.jsx') || ext === '.jsx') {
        return 'javascriptreact';
    }
    if (ext === '.ts') {
        return 'typescript';
    }
    if (ext === '.js') {
        return 'javascript';
    }

    // Fallback: try to detect from document
    try {
        const document = await vscode.workspace.openTextDocument(uri);
        return document.languageId;
    } catch {
        return 'plaintext';
    }
}

/**
 * Check if a language is supported for analysis
 */
export function isSupportedLanguage(languageId: string): boolean {
    return SUPPORTED_LANGUAGES.includes(languageId.toLowerCase());
}

/**
 * Find files in workspace matching pattern
 */
export async function findWorkspaceFiles(
    workspaceFolder: vscode.WorkspaceFolder,
    pattern: string = '**/*.{ts,js,tsx,jsx}',
    excludes: string[] = DEFAULT_EXCLUDES,
    maxFiles: number = 10000
): Promise<vscode.Uri[]> {
    const filePattern = new vscode.RelativePattern(workspaceFolder, pattern);
    const files = await vscode.workspace.findFiles(
        filePattern,
        excludes.join(','),
        maxFiles
    );
    return files;
}

