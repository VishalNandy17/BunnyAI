import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/logger';

export type Framework = 'express' | 'nestjs' | 'fastapi' | 'flask' | 'django' | 'laravel' | 'springboot' | 'gogin' | 'unknown';

export interface FrameworkInfo {
    framework: Framework;
    confidence: number;
    configFiles: string[];
}

export class WorkspaceDetector {
    private static instance: WorkspaceDetector;

    private constructor() {}

    public static getInstance(): WorkspaceDetector {
        if (!WorkspaceDetector.instance) {
            WorkspaceDetector.instance = new WorkspaceDetector();
        }
        return WorkspaceDetector.instance;
    }

    async detectFramework(workspaceFolder?: vscode.WorkspaceFolder): Promise<FrameworkInfo> {
        try {
            const rootPath = workspaceFolder?.uri.fsPath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!rootPath) {
                return { framework: 'unknown', confidence: 0, configFiles: [] };
            }

            const frameworkScores: Map<Framework, number> = new Map();
            const configFiles: string[] = [];

            // Check for package.json (Node.js projects)
            const packageJsonPath = path.join(rootPath, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                try {
                    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

                    if (dependencies.express) {
                        frameworkScores.set('express', (frameworkScores.get('express') || 0) + 10);
                        configFiles.push('package.json');
                    }
                    if (dependencies['@nestjs/core']) {
                        frameworkScores.set('nestjs', (frameworkScores.get('nestjs') || 0) + 10);
                        configFiles.push('package.json');
                    }
                } catch (e) {
                    Logger.log('Failed to parse package.json');
                }
            }

            // Check for requirements.txt or pyproject.toml (Python projects)
            if (fs.existsSync(path.join(rootPath, 'requirements.txt'))) {
                const requirements = fs.readFileSync(path.join(rootPath, 'requirements.txt'), 'utf-8');
                if (requirements.includes('fastapi')) {
                    frameworkScores.set('fastapi', (frameworkScores.get('fastapi') || 0) + 10);
                    configFiles.push('requirements.txt');
                }
                if (requirements.includes('flask')) {
                    frameworkScores.set('flask', (frameworkScores.get('flask') || 0) + 10);
                    configFiles.push('requirements.txt');
                }
                if (requirements.includes('django')) {
                    frameworkScores.set('django', (frameworkScores.get('django') || 0) + 10);
                    configFiles.push('requirements.txt');
                }
            }

            // Check for composer.json (PHP/Laravel)
            if (fs.existsSync(path.join(rootPath, 'composer.json'))) {
                try {
                    const composerJson = JSON.parse(fs.readFileSync(path.join(rootPath, 'composer.json'), 'utf-8'));
                    if (composerJson.require?.['laravel/framework']) {
                        frameworkScores.set('laravel', (frameworkScores.get('laravel') || 0) + 10);
                        configFiles.push('composer.json');
                    }
                } catch (e) {
                    Logger.log('Failed to parse composer.json');
                }
            }

            // Check for pom.xml (Spring Boot)
            if (fs.existsSync(path.join(rootPath, 'pom.xml'))) {
                frameworkScores.set('springboot', (frameworkScores.get('springboot') || 0) + 10);
                configFiles.push('pom.xml');
            }

            // Check for go.mod (Go/Gin)
            if (fs.existsSync(path.join(rootPath, 'go.mod'))) {
                const goMod = fs.readFileSync(path.join(rootPath, 'go.mod'), 'utf-8');
                if (goMod.includes('gin-gonic/gin')) {
                    frameworkScores.set('gogin', (frameworkScores.get('gogin') || 0) + 10);
                    configFiles.push('go.mod');
                }
            }

            // Find the framework with highest score
            let detectedFramework: Framework = 'unknown';
            let maxScore = 0;

            frameworkScores.forEach((score, framework) => {
                if (score > maxScore) {
                    maxScore = score;
                    detectedFramework = framework;
                }
            });

            const confidence = maxScore > 0 ? Math.min(maxScore / 10, 1) : 0;

            Logger.log(`Detected framework: ${detectedFramework} (confidence: ${confidence})`);
            return {
                framework: detectedFramework,
                confidence,
                configFiles
            };
        } catch (error) {
            Logger.error('Failed to detect framework', error);
            return { framework: 'unknown', confidence: 0, configFiles: [] };
        }
    }

    async detectFromFile(filePath: string): Promise<Framework> {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const fileName = path.basename(filePath);

            // Check file patterns
            if (fileName.includes('app.py') && content.includes('Flask')) {
                return 'flask';
            }
            if (fileName.includes('main.py') && (content.includes('FastAPI') || content.includes('from fastapi'))) {
                return 'fastapi';
            }
            if (content.includes('@nestjs') || content.includes('@Controller')) {
                return 'nestjs';
            }
            if (content.includes('express') && content.includes('require') || content.includes('import')) {
                return 'express';
            }
            if (content.includes('@RestController') || content.includes('@RequestMapping')) {
                return 'springboot';
            }
            if (content.includes('gin.') || content.includes('gin.Default')) {
                return 'gogin';
            }

            return 'unknown';
        } catch (error) {
            Logger.error('Failed to detect framework from file', error);
            return 'unknown';
        }
    }
}

