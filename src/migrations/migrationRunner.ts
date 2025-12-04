import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { MigrationDefinition, MigrationAnalysis, WorkspaceInfo, MigrationResult, ProjectInfo } from './types';
import { ProjectDetector } from './projectDetector';
import { findWorkspaceFiles, DEFAULT_EXCLUDES } from '../analysis/analyzerUtils';
import { AIProvider } from '../ai/AIProvider';
import { RefactorPlan } from '../refactor/refactorExecutor';
import { Logger } from '../utils/logger';

export class MigrationRunner {
    private aiProvider: AIProvider;

    constructor() {
        this.aiProvider = new AIProvider();
    }

    /**
     * Collect workspace information for migration
     */
    async collectWorkspaceInfo(workspaceFolder: vscode.WorkspaceFolder): Promise<WorkspaceInfo> {
        const projectInfo = await ProjectDetector.detect(workspaceFolder);
        const workspacePath = workspaceFolder.uri.fsPath;
        
        const files: WorkspaceInfo['files'] = [];
        const fileUris = await findWorkspaceFiles(
            workspaceFolder,
            '**/*.{ts,js,tsx,jsx,py,java,go,php,json}',
            DEFAULT_EXCLUDES,
            1000
        );

        for (const fileUri of fileUris) {
            try {
                const relativePath = path.relative(workspacePath, fileUri.fsPath);
                const content = fs.readFileSync(fileUri.fsPath, 'utf-8');
                const languageId = await this.getLanguageId(fileUri);
                
                files.push({
                    path: fileUri.fsPath,
                    relativePath,
                    content,
                    languageId
                });
            } catch (e) {
                Logger.log(`Error reading file ${fileUri.fsPath}: ${e}`);
            }
        }

        return {
            workspaceFolder,
            files,
            projectInfo
        };
    }

    /**
     * Run migration analysis
     */
    async analyzeMigration(migration: MigrationDefinition, workspace: WorkspaceInfo): Promise<MigrationAnalysis> {
        return await migration.analyze(workspace);
    }

    /**
     * Generate refactor plan using AI
     */
    async generateRefactorPlan(
        migration: MigrationDefinition,
        analysis: MigrationAnalysis,
        workspace: WorkspaceInfo
    ): Promise<RefactorPlan | undefined> {
        if (!analysis.applicable) {
            return undefined;
        }

        // Collect relevant files for AI
        const relevantFiles = workspace.files.filter(f => 
            analysis.filesToMigrate.includes(f.relativePath)
        );

        // Build prompt for AI
        const prompt = this.buildMigrationPrompt(migration, analysis, relevantFiles);

        try {
            const aiResponse = await this.aiProvider.generateRefactorPlan(
                prompt,
                relevantFiles.map(f => ({
                    path: f.relativePath,
                    content: f.content.substring(0, 5000) // Limit content size
                }))
            );

            return aiResponse;
        } catch (error) {
            Logger.log(`Error generating refactor plan: ${error}`);
            return undefined;
        }
    }

    /**
     * Get before/after examples from refactor plan
     */
    extractExamples(plan: RefactorPlan, workspace: WorkspaceInfo): {
        beforeExamples: Array<{ file: string; content: string }>;
        afterExamples: Array<{ file: string; content: string }>;
    } {
        const beforeExamples: Array<{ file: string; content: string }> = [];
        const afterExamples: Array<{ file: string; content: string }> = [];

        // Extract from edits
        for (const edit of plan.edits || []) {
            const file = workspace.files.find(f => f.relativePath === edit.file);
            if (file) {
                beforeExamples.push({
                    file: edit.file,
                    content: edit.oldText || file.content.substring(0, 500)
                });
                afterExamples.push({
                    file: edit.file,
                    content: edit.newText || edit.oldText || ''
                });
            }
        }

        // Extract from creates
        for (const create of plan.creates || []) {
            afterExamples.push({
                file: create.file,
                content: create.content.substring(0, 500)
            });
        }

        return { beforeExamples, afterExamples };
    }

    private buildMigrationPrompt(
        migration: MigrationDefinition,
        analysis: MigrationAnalysis,
        files: WorkspaceInfo['files']
    ): string {
        const fileSummaries = files.map(f => 
            `File: ${f.relativePath}\n` +
            `Language: ${f.languageId}\n` +
            `Content (first 200 lines):\n${f.content.split('\n').slice(0, 200).join('\n')}\n`
        ).join('\n---\n\n');

        return `${migration.aiRewriteInstruction}

Migration Analysis:
- Files to migrate: ${analysis.filesToMigrate.length}
- Complexity: ${analysis.estimatedComplexity}
- Warnings: ${analysis.warnings.join(', ')}
- Recommendations: ${analysis.recommendations.join(', ')}

Files to migrate:
${fileSummaries}

Generate a RefactorPlan JSON with edits, moves, and creates as needed. Be thorough and accurate.`;
    }

    private async getLanguageId(uri: vscode.Uri): Promise<string> {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            return document.languageId;
        } catch {
            // Fallback to extension-based detection
            const ext = path.extname(uri.fsPath);
            const extMap: Record<string, string> = {
                '.js': 'javascript',
                '.ts': 'typescript',
                '.jsx': 'javascriptreact',
                '.tsx': 'typescriptreact',
                '.py': 'python',
                '.java': 'java',
                '.go': 'go',
                '.php': 'php',
                '.json': 'json'
            };
            return extMap[ext] || 'plaintext';
        }
    }
}

