import * as fs from 'fs';
import * as path from 'path';
import { MigrationDefinition, MigrationAnalysis, WorkspaceInfo, ProjectInfo } from '../types';

export const jsToTsMigration: MigrationDefinition = {
    id: 'js-to-ts',
    name: 'JavaScript to TypeScript',
    description: 'Migrate JavaScript files to TypeScript with basic type annotations',
    appliesTo: (projectInfo: ProjectInfo) => {
        return projectInfo.type === 'node' || 
               projectInfo.type === 'react' || 
               projectInfo.type === 'express' &&
               !projectInfo.hasTypeScript;
    },
    analyze: async (workspace: WorkspaceInfo): Promise<MigrationAnalysis> => {
        const jsFiles: string[] = [];
        const warnings: string[] = [];
        const recommendations: string[] = [];

        for (const file of workspace.files) {
            if (file.languageId === 'javascript' && 
                !file.relativePath.includes('node_modules') &&
                !file.relativePath.includes('.min.js')) {
                jsFiles.push(file.relativePath);
            }
        }

        if (jsFiles.length === 0) {
            return {
                applicable: false,
                filesToMigrate: [],
                estimatedComplexity: 'low',
                warnings: ['No JavaScript files found to migrate'],
                recommendations: [],
                summary: 'No JavaScript files detected in the workspace'
            };
        }

        // Check if tsconfig.json exists
        const tsConfigPath = path.join(workspace.workspaceFolder.uri.fsPath, 'tsconfig.json');
        if (!fs.existsSync(tsConfigPath)) {
            warnings.push('tsconfig.json not found. One will need to be created.');
            recommendations.push('Create a tsconfig.json file with appropriate compiler options');
        }

        // Check for TypeScript dependency
        if (!workspace.projectInfo.dependencies?.typescript && 
            !workspace.projectInfo.dependencies?.['@types/node']) {
            recommendations.push('Install TypeScript: npm install --save-dev typescript @types/node');
        }

        const complexity = jsFiles.length > 50 ? 'high' : jsFiles.length > 20 ? 'medium' : 'low';

        return {
            applicable: true,
            filesToMigrate: jsFiles,
            estimatedComplexity: complexity,
            warnings,
            recommendations,
            summary: `Found ${jsFiles.length} JavaScript file(s) that can be migrated to TypeScript`
        };
    },
    aiRewriteInstruction: `You are migrating JavaScript code to TypeScript. For each JavaScript file:

1. Rename .js to .ts (or .jsx to .tsx for React files)
2. Add type annotations:
   - Function parameters and return types
   - Variable types where inference is unclear
   - Interface/type definitions for objects
   - Generic types where applicable
3. Fix any type errors that arise
4. Preserve all functionality exactly
5. Use 'any' sparingly - prefer proper types
6. Add JSDoc comments converted to TypeScript types where helpful

Return a RefactorPlan with:
- edits: File renames (.js -> .ts) and content updates with type annotations
- creates: New .ts files with typed versions
- summary: Brief description of changes`
};

