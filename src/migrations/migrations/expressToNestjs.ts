import * as fs from 'fs';
import * as path from 'path';
import { MigrationDefinition, MigrationAnalysis, WorkspaceInfo, ProjectInfo } from '../types';

export const expressToNestjsMigration: MigrationDefinition = {
    id: 'express-to-nestjs',
    name: 'Express to NestJS',
    description: 'Migrate Express.js routes to NestJS controller structure',
    appliesTo: (projectInfo: ProjectInfo) => {
        return projectInfo.type === 'express' && !projectInfo.hasTypeScript;
    },
    analyze: async (workspace: WorkspaceInfo): Promise<MigrationAnalysis> => {
        const routeFiles: string[] = [];
        const appFiles: string[] = [];
        const warnings: string[] = [];
        const recommendations: string[] = [];

        // Find Express route files
        for (const file of workspace.files) {
            const content = file.content.toLowerCase();
            if ((file.languageId === 'javascript' || file.languageId === 'typescript') &&
                (content.includes('express') || content.includes('router') || content.includes('app.get') || content.includes('app.post'))) {
                if (file.relativePath.includes('route') || 
                    file.relativePath.includes('api') ||
                    content.includes('router.') ||
                    content.includes('app.get') ||
                    content.includes('app.post')) {
                    routeFiles.push(file.relativePath);
                }
                if (file.relativePath.includes('app.js') || file.relativePath.includes('server.js') || file.relativePath.includes('index.js')) {
                    appFiles.push(file.relativePath);
                }
            }
        }

        if (routeFiles.length === 0 && appFiles.length === 0) {
            return {
                applicable: false,
                filesToMigrate: [],
                estimatedComplexity: 'low',
                warnings: ['No Express route files found'],
                recommendations: [],
                summary: 'No Express.js routes detected in the workspace'
            };
        }

        warnings.push('This migration creates a skeleton NestJS structure. Manual adjustments will be needed.');
        warnings.push('Middleware and complex Express features may need manual migration.');
        
        recommendations.push('Install NestJS: npm install @nestjs/core @nestjs/common @nestjs/platform-express');
        recommendations.push('Install NestJS CLI: npm install -g @nestjs/cli');
        recommendations.push('Review and manually migrate middleware, error handlers, and custom Express features');

        const complexity = routeFiles.length > 10 ? 'high' : routeFiles.length > 5 ? 'medium' : 'low';

        return {
            applicable: true,
            filesToMigrate: [...routeFiles, ...appFiles],
            estimatedComplexity: complexity,
            warnings,
            recommendations,
            summary: `Found ${routeFiles.length} route file(s) and ${appFiles.length} app file(s) to migrate to NestJS structure`
        };
    },
    aiRewriteInstruction: `You are migrating Express.js routes to NestJS controllers. For each Express route file:

1. Convert Express routes to NestJS controllers:
   - app.get('/path', handler) -> @Get('/path') method in a controller class
   - app.post('/path', handler) -> @Post('/path') method
   - app.put('/path', handler) -> @Put('/path') method
   - app.delete('/path', handler) -> @Delete('/path') method
   - Express Router -> NestJS Controller class with @Controller() decorator

2. Convert route handlers:
   - (req, res) => {} -> async method(req: Request, res: Response) {}
   - Use NestJS decorators: @Body(), @Param(), @Query(), @Headers()
   - Replace res.json() with return statements
   - Replace res.status().json() with HttpException or return

3. Create module structure:
   - Create a module file with @Module() decorator
   - Register controllers in the module
   - Create a main.ts with NestFactory.create()

4. Preserve all route logic and functionality

Return a RefactorPlan with:
- edits: Convert existing route files to NestJS controllers
- creates: New NestJS module files, main.ts, app.module.ts
- summary: Description of the NestJS structure created`
};

