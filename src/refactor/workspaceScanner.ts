import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { findWorkspaceFiles, DEFAULT_EXCLUDES } from '../analysis/analyzerUtils';
import { CodeQualityAnalyzer } from '../analysis/codeQualityAnalyzer';

export interface FileInfo {
    file: string;
    relativePath: string;
    languageId: string;
    content: string;
    hash: string;
    imports: string[];
    exports: string[];
    complexity?: {
        average: number;
        max: number;
        functionCount: number;
    };
    lineCount: number;
}

export interface WorkspaceScanResult {
    files: FileInfo[];
    totalFiles: number;
    languages: Map<string, number>;
    rootFiles: string[];
}

export class WorkspaceRefactorScanner {
    private codeQualityAnalyzer: CodeQualityAnalyzer;

    constructor() {
        this.codeQualityAnalyzer = new CodeQualityAnalyzer();
    }

    async scanWorkspace(workspaceFolder: vscode.WorkspaceFolder): Promise<WorkspaceScanResult> {
        const files: FileInfo[] = [];
        const languages = new Map<string, number>();
        const rootFiles: string[] = [];

        const workspacePath = workspaceFolder.uri.fsPath;
        const fileUris = await findWorkspaceFiles(
            workspaceFolder,
            '**/*.{ts,js,tsx,jsx,py,java,go,php}',
            DEFAULT_EXCLUDES,
            10000
        );

        for (const fileUri of fileUris) {
            try {
                const relativePath = path.relative(workspacePath, fileUri.fsPath);
                const content = fs.readFileSync(fileUri.fsPath, 'utf-8');
                const hash = this.computeHash(content);
                const languageId = await this.getLanguageId(fileUri);

                // Check if root file
                const dir = path.dirname(relativePath);
                if (dir === '.' || dir === '') {
                    rootFiles.push(relativePath);
                }

                // Extract imports and exports
                const { imports, exports } = this.extractImportsExports(content, languageId);

                // Calculate complexity
                let complexity: { average: number; max: number; functionCount: number } | undefined;
                if (['typescript', 'javascript', 'typescriptreact', 'javascriptreact'].includes(languageId)) {
                    try {
                        const qualityReport = this.codeQualityAnalyzer.analyzeCode(content, fileUri.fsPath);
                        if (qualityReport.functions.length > 0) {
                            const complexities = qualityReport.functions.map(f => f.cyclomatic);
                            complexity = {
                                average: complexities.reduce((a, b) => a + b, 0) / complexities.length,
                                max: Math.max(...complexities),
                                functionCount: qualityReport.functions.length
                            };
                        }
                    } catch {
                        // Ignore complexity calculation errors
                    }
                }

                const lineCount = content.split('\n').length;

                files.push({
                    file: fileUri.fsPath,
                    relativePath: relativePath,
                    languageId: languageId,
                    content: content,
                    hash: hash,
                    imports: imports,
                    exports: exports,
                    complexity: complexity,
                    lineCount: lineCount
                });

                // Track language distribution
                languages.set(languageId, (languages.get(languageId) || 0) + 1);
            } catch (error) {
                // Skip files that can't be read
                continue;
            }
        }

        return {
            files,
            totalFiles: files.length,
            languages,
            rootFiles
        };
    }

    private computeHash(content: string): string {
        return crypto.createHash('md5').update(content).digest('hex');
    }

    private async getLanguageId(uri: vscode.Uri): Promise<string> {
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
        if (ext === '.py') {
            return 'python';
        }
        if (ext === '.java') {
            return 'java';
        }
        if (ext === '.go') {
            return 'go';
        }
        if (ext === '.php') {
            return 'php';
        }

        try {
            const document = await vscode.workspace.openTextDocument(uri);
            return document.languageId;
        } catch {
            return 'plaintext';
        }
    }

    private extractImportsExports(content: string, languageId: string): { imports: string[]; exports: string[] } {
        const imports: string[] = [];
        const exports: string[] = [];

        if (['typescript', 'javascript', 'typescriptreact', 'javascriptreact'].includes(languageId)) {
            // JavaScript/TypeScript
            const importRegex = /(?:import\s+(?:.*?\s+from\s+)?|require\s*\(\s*)(['"])([^'"]+)\1/g;
            const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type|enum)\s+(\w+)/g;

            let match;
            while ((match = importRegex.exec(content)) !== null) {
                imports.push(match[2]);
            }
            while ((match = exportRegex.exec(content)) !== null) {
                exports.push(match[1]);
            }
        } else if (languageId === 'python') {
            // Python
            const importRegex = /(?:^|\n)(?:import\s+(\w+)|from\s+([\w.]+)\s+import)/gm;
            const exportRegex = /^def\s+(\w+)|^class\s+(\w+)/gm;

            let match;
            while ((match = importRegex.exec(content)) !== null) {
                if (match[1]) imports.push(match[1]);
                if (match[2]) imports.push(match[2]);
            }
            while ((match = exportRegex.exec(content)) !== null) {
                if (match[1]) exports.push(match[1]);
                if (match[2]) exports.push(match[2]);
            }
        } else if (languageId === 'java') {
            // Java
            const importRegex = /^import\s+([\w.]+)/gm;
            const exportRegex = /^(?:public\s+)?(?:class|interface|enum)\s+(\w+)/gm;

            let match;
            while ((match = importRegex.exec(content)) !== null) {
                imports.push(match[1]);
            }
            while ((match = exportRegex.exec(content)) !== null) {
                exports.push(match[1]);
            }
        } else if (languageId === 'go') {
            // Go
            const importRegex = /import\s+(?:\(([^)]+)\)|"([^"]+)"|(\w+)\s+"([^"]+)")/g;
            const exportRegex = /^(?:func|type|const|var)\s+(\w+)/gm;

            let match;
            while ((match = importRegex.exec(content)) !== null) {
                if (match[1]) {
                    // Grouped imports
                    const groupedMatches = match[1].match(/"([^"]+)"/g);
                    if (groupedMatches) {
                        groupedMatches.forEach(m => {
                            const quoted = m.match(/"([^"]+)"/);
                            if (quoted) imports.push(quoted[1]);
                        });
                    }
                }
                if (match[2]) imports.push(match[2]);
                if (match[4]) imports.push(match[4]);
            }
            while ((match = exportRegex.exec(content)) !== null) {
                exports.push(match[1]);
            }
        }

        return { imports, exports };
    }

    /**
     * Get file summary (first 200 lines) for AI analysis
     */
    getFileSummary(fileInfo: FileInfo): string {
        const lines = fileInfo.content.split('\n');
        const summaryLines = lines.slice(0, 200);
        return summaryLines.join('\n');
    }
}

