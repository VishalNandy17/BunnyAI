import * as vscode from 'vscode';

export interface ProjectInfo {
    type: 'node' | 'python' | 'react' | 'vue' | 'angular' | 'express' | 'nestjs' | 'django' | 'flask' | 'unknown';
    framework?: string;
    hasTypeScript?: boolean;
    hasJSX?: boolean;
    packageManager?: 'npm' | 'yarn' | 'pnpm';
    dependencies?: Record<string, string>;
}

export interface WorkspaceInfo {
    workspaceFolder: vscode.WorkspaceFolder;
    files: Array<{
        path: string;
        relativePath: string;
        content: string;
        languageId: string;
    }>;
    projectInfo: ProjectInfo;
}

export interface MigrationAnalysis {
    applicable: boolean;
    filesToMigrate: string[];
    estimatedComplexity: 'low' | 'medium' | 'high';
    warnings: string[];
    recommendations: string[];
    summary: string;
}

export interface MigrationDefinition {
    id: string;
    name: string;
    description: string;
    appliesTo: (projectInfo: ProjectInfo) => boolean;
    analyze: (workspace: WorkspaceInfo) => Promise<MigrationAnalysis>;
    aiRewriteInstruction: string;
}

export interface MigrationResult {
    migrationId: string;
    analysis: MigrationAnalysis;
    refactorPlan?: import('../refactor/refactorExecutor').RefactorPlan;
    beforeExamples: Array<{
        file: string;
        content: string;
    }>;
    afterExamples: Array<{
        file: string;
        content: string;
    }>;
}
