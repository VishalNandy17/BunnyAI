import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ProjectInfo } from './types';

export class ProjectDetector {
    /**
     * Detect project type and characteristics
     */
    static async detect(workspaceFolder: vscode.WorkspaceFolder): Promise<ProjectInfo> {
        const workspacePath = workspaceFolder.uri.fsPath;
        const packageJsonPath = path.join(workspacePath, 'package.json');
        const tsConfigPath = path.join(workspacePath, 'tsconfig.json');
        const requirementsPath = path.join(workspacePath, 'requirements.txt');
        const goModPath = path.join(workspacePath, 'go.mod');

        const projectInfo: ProjectInfo = {
            type: 'unknown',
            hasTypeScript: false,
            hasJSX: false
        };

        // Check for Node.js projects
        if (fs.existsSync(packageJsonPath)) {
            try {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                projectInfo.type = 'node';
                projectInfo.packageManager = this.detectPackageManager(workspacePath);
                projectInfo.dependencies = {
                    ...packageJson.dependencies,
                    ...packageJson.devDependencies
                };

                // Check for TypeScript
                if (fs.existsSync(tsConfigPath) || 
                    packageJson.devDependencies?.typescript ||
                    packageJson.dependencies?.typescript) {
                    projectInfo.hasTypeScript = true;
                }

                // Check for React
                if (packageJson.dependencies?.react || packageJson.devDependencies?.react) {
                    projectInfo.type = 'react';
                    projectInfo.framework = 'react';
                    projectInfo.hasJSX = true;
                }

                // Check for Express
                if (packageJson.dependencies?.express || packageJson.devDependencies?.express) {
                    if (projectInfo.type === 'node') {
                        projectInfo.type = 'express';
                        projectInfo.framework = 'express';
                    }
                }

                // Check for NestJS
                if (packageJson.dependencies?.['@nestjs/core'] || packageJson.devDependencies?.['@nestjs/core']) {
                    projectInfo.type = 'nestjs';
                    projectInfo.framework = 'nestjs';
                }

                // Check for Vue
                if (packageJson.dependencies?.vue || packageJson.devDependencies?.vue) {
                    projectInfo.type = 'vue';
                    projectInfo.framework = 'vue';
                }

                // Check for Angular
                if (packageJson.dependencies?.['@angular/core'] || packageJson.devDependencies?.['@angular/core']) {
                    projectInfo.type = 'angular';
                    projectInfo.framework = 'angular';
                }
            } catch (e) {
                // Invalid package.json
            }
        }

        // Check for Python projects
        if (fs.existsSync(requirementsPath) || fs.existsSync(path.join(workspacePath, 'setup.py'))) {
            projectInfo.type = 'python';
            
            // Check for Django
            if (fs.existsSync(path.join(workspacePath, 'manage.py'))) {
                projectInfo.type = 'django';
                projectInfo.framework = 'django';
            }
            
            // Check for Flask
            if (fs.existsSync(path.join(workspacePath, 'app.py')) || 
                fs.existsSync(path.join(workspacePath, 'flask_app.py'))) {
                if (projectInfo.type === 'python') {
                    projectInfo.type = 'flask';
                    projectInfo.framework = 'flask';
                }
            }
        }

        // Check for Go projects
        if (fs.existsSync(goModPath)) {
            projectInfo.type = 'node'; // We'll treat Go as node-like for now
        }

        return projectInfo;
    }

    private static detectPackageManager(workspacePath: string): 'npm' | 'yarn' | 'pnpm' {
        if (fs.existsSync(path.join(workspacePath, 'yarn.lock'))) {
            return 'yarn';
        }
        if (fs.existsSync(path.join(workspacePath, 'pnpm-lock.yaml'))) {
            return 'pnpm';
        }
        return 'npm';
    }
}

