import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { findWorkspaceFiles, DEFAULT_EXCLUDES } from '../analysis/analyzerUtils';

export interface ModuleInfo {
    name: string;
    path: string;
    type: 'module' | 'component' | 'service' | 'util' | 'test' | 'config';
    files: string[];
    dependencies: string[];
    exports: string[];
}

export interface ComponentInfo {
    name: string;
    file: string;
    type: 'class' | 'function' | 'interface' | 'type' | 'component';
    module?: string;
    dependencies: string[];
    exports: string[];
}

export interface DependencyEdge {
    from: string;
    to: string;
    type: 'import' | 'require' | 'extends' | 'implements' | 'uses';
    file?: string;
}

export interface ArchitectureModel {
    projectType: string;
    framework?: string;
    rootFiles: string[];
    modules: ModuleInfo[];
    components: ComponentInfo[];
    dependencies: DependencyEdge[];
    packageManager?: string;
    buildTool?: string;
}

export class ArchitectureScanner {
    private workspacePath: string = '';
    private fileCache: Map<string, string> = new Map();
    private importMap: Map<string, Set<string>> = new Map();
    private exportMap: Map<string, Set<string>> = new Map();

    async scanWorkspace(workspaceFolder: vscode.WorkspaceFolder): Promise<ArchitectureModel> {
        this.workspacePath = workspaceFolder.uri.fsPath;
        this.fileCache.clear();
        this.importMap.clear();
        this.exportMap.clear();

        // Detect project type and framework
        const projectType = await this.detectProjectType();
        const framework = await this.detectFramework();
        const packageManager = await this.detectPackageManager();
        const buildTool = await this.detectBuildTool();

        // Get root files
        const rootFiles = this.getRootFiles();

        // Scan files and build dependency graph
        const files = await findWorkspaceFiles(
            workspaceFolder,
            '**/*.{ts,js,tsx,jsx,py,java,go,php}',
            DEFAULT_EXCLUDES,
            10000
        );

        for (const fileUri of files) {
            await this.scanFile(fileUri.fsPath);
        }

        // Build modules
        const modules = this.buildModules(files.map(f => f.fsPath));

        // Build components
        const components = this.buildComponents(files.map(f => f.fsPath));

        // Build dependency edges
        const dependencies = this.buildDependencyEdges();

        return {
            projectType,
            framework,
            rootFiles,
            modules,
            components,
            dependencies,
            packageManager,
            buildTool
        };
    }

    private async detectProjectType(): Promise<string> {
        const packageJson = path.join(this.workspacePath, 'package.json');
        if (fs.existsSync(packageJson)) {
            return 'Node.js';
        }

        const requirementsTxt = path.join(this.workspacePath, 'requirements.txt');
        const setupPy = path.join(this.workspacePath, 'setup.py');
        const pyprojectToml = path.join(this.workspacePath, 'pyproject.toml');
        if (fs.existsSync(requirementsTxt) || fs.existsSync(setupPy) || fs.existsSync(pyprojectToml)) {
            return 'Python';
        }

        const pomXml = path.join(this.workspacePath, 'pom.xml');
        const buildGradle = path.join(this.workspacePath, 'build.gradle');
        if (fs.existsSync(pomXml) || fs.existsSync(buildGradle)) {
            return 'Java';
        }

        const goMod = path.join(this.workspacePath, 'go.mod');
        if (fs.existsSync(goMod)) {
            return 'Go';
        }

        const composerJson = path.join(this.workspacePath, 'composer.json');
        if (fs.existsSync(composerJson)) {
            return 'PHP';
        }

        return 'Unknown';
    }

    private async detectFramework(): Promise<string | undefined> {
        const packageJson = path.join(this.workspacePath, 'package.json');
        if (fs.existsSync(packageJson)) {
            try {
                const content = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
                const deps = { ...content.dependencies, ...content.devDependencies };

                if (deps['next']) return 'Next.js';
                if (deps['react'] && deps['react-scripts']) return 'Create React App';
                if (deps['react']) return 'React';
                if (deps['vue']) return 'Vue.js';
                if (deps['angular']) return 'Angular';
                if (deps['express']) return 'Express';
                if (deps['@nestjs/core']) return 'NestJS';
                if (deps['fastify']) return 'Fastify';
            } catch {
                // Ignore
            }
        }

        const requirementsTxt = path.join(this.workspacePath, 'requirements.txt');
        if (fs.existsSync(requirementsTxt)) {
            const content = fs.readFileSync(requirementsTxt, 'utf-8');
            if (content.includes('django')) return 'Django';
            if (content.includes('flask')) return 'Flask';
            if (content.includes('fastapi')) return 'FastAPI';
        }

        const pomXml = path.join(this.workspacePath, 'pom.xml');
        if (fs.existsSync(pomXml)) {
            const content = fs.readFileSync(pomXml, 'utf-8');
            if (content.includes('spring-boot')) return 'Spring Boot';
        }

        const composerJson = path.join(this.workspacePath, 'composer.json');
        if (fs.existsSync(composerJson)) {
            try {
                const content = JSON.parse(fs.readFileSync(composerJson, 'utf-8'));
                if (content.require && content.require['laravel/framework']) return 'Laravel';
            } catch {
                // Ignore
            }
        }

        return undefined;
    }

    private async detectPackageManager(): Promise<string | undefined> {
        if (fs.existsSync(path.join(this.workspacePath, 'package-lock.json'))) {
            return 'npm';
        }
        if (fs.existsSync(path.join(this.workspacePath, 'yarn.lock'))) {
            return 'yarn';
        }
        if (fs.existsSync(path.join(this.workspacePath, 'pnpm-lock.yaml'))) {
            return 'pnpm';
        }
        return undefined;
    }

    private async detectBuildTool(): Promise<string | undefined> {
        if (fs.existsSync(path.join(this.workspacePath, 'webpack.config.js'))) {
            return 'webpack';
        }
        if (fs.existsSync(path.join(this.workspacePath, 'vite.config.js')) || 
            fs.existsSync(path.join(this.workspacePath, 'vite.config.ts'))) {
            return 'vite';
        }
        if (fs.existsSync(path.join(this.workspacePath, 'tsconfig.json'))) {
            return 'TypeScript';
        }
        return undefined;
    }

    private getRootFiles(): string[] {
        const rootFiles: string[] = [];
        const commonRootFiles = [
            'package.json', 'README.md', 'index.js', 'index.ts', 'main.js', 'main.ts',
            'app.py', 'main.py', 'main.go', 'pom.xml', 'build.gradle', 'composer.json'
        ];

        for (const file of commonRootFiles) {
            const filePath = path.join(this.workspacePath, file);
            if (fs.existsSync(filePath)) {
                rootFiles.push(file);
            }
        }

        return rootFiles;
    }

    private async scanFile(filePath: string): Promise<void> {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            this.fileCache.set(filePath, content);

            const relativePath = path.relative(this.workspacePath, filePath);
            const ext = path.extname(filePath).toLowerCase();

            if (['.ts', '.js', '.tsx', '.jsx'].includes(ext)) {
                this.scanJavaScriptFile(content, relativePath);
            } else if (ext === '.py') {
                this.scanPythonFile(content, relativePath);
            } else if (ext === '.java') {
                this.scanJavaFile(content, relativePath);
            } else if (ext === '.go') {
                this.scanGoFile(content, relativePath);
            }
        } catch (error) {
            // Ignore errors
        }
    }

    private scanJavaScriptFile(content: string, filePath: string): void {
        // Match imports: import ... from '...' or require('...')
        const importRegex = /(?:import\s+(?:.*?\s+from\s+)?|require\s*\(\s*)(['"])([^'"]+)\1/g;
        const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type|enum)\s+(\w+)/g;

        const imports = new Set<string>();
        const exports = new Set<string>();

        let match;
        while ((match = importRegex.exec(content)) !== null) {
            imports.add(match[2]);
        }

        while ((match = exportRegex.exec(content)) !== null) {
            exports.add(match[1]);
        }

        if (imports.size > 0) {
            this.importMap.set(filePath, imports);
        }
        if (exports.size > 0) {
            this.exportMap.set(filePath, exports);
        }
    }

    private scanPythonFile(content: string, filePath: string): void {
        // Match imports: import ... or from ... import ...
        const importRegex = /(?:^|\n)(?:import\s+(\w+)|from\s+([\w.]+)\s+import)/gm;
        const exportRegex = /^def\s+(\w+)|^class\s+(\w+)/gm;

        const imports = new Set<string>();
        const exports = new Set<string>();

        let match;
        while ((match = importRegex.exec(content)) !== null) {
            if (match[1]) imports.add(match[1]);
            if (match[2]) imports.add(match[2]);
        }

        while ((match = exportRegex.exec(content)) !== null) {
            if (match[1]) exports.add(match[1]);
            if (match[2]) exports.add(match[2]);
        }

        if (imports.size > 0) {
            this.importMap.set(filePath, imports);
        }
        if (exports.size > 0) {
            this.exportMap.set(filePath, exports);
        }
    }

    private scanJavaFile(content: string, filePath: string): void {
        // Match imports: import ...;
        const importRegex = /^import\s+([\w.]+)/gm;
        const exportRegex = /^(?:public\s+)?(?:class|interface|enum)\s+(\w+)/gm;

        const imports = new Set<string>();
        const exports = new Set<string>();

        let match;
        while ((match = importRegex.exec(content)) !== null) {
            imports.add(match[1]);
        }

        while ((match = exportRegex.exec(content)) !== null) {
            exports.add(match[1]);
        }

        if (imports.size > 0) {
            this.importMap.set(filePath, imports);
        }
        if (exports.size > 0) {
            this.exportMap.set(filePath, exports);
        }
    }

    private scanGoFile(content: string, filePath: string): void {
        // Match imports: import "..." or import (...)
        const importRegex = /import\s+(?:\(([^)]+)\)|"([^"]+)"|(\w+)\s+"([^"]+)")/g;
        const exportRegex = /^(?:func|type|const|var)\s+(\w+)/gm;

        const imports = new Set<string>();
        const exports = new Set<string>();

        let match;
        while ((match = importRegex.exec(content)) !== null) {
            if (match[1]) {
                // Grouped imports - extract each quoted string
                const groupedMatches = match[1].match(/"([^"]+)"/g);
                if (groupedMatches) {
                    groupedMatches.forEach(m => {
                        const quoted = m.match(/"([^"]+)"/);
                        if (quoted) imports.add(quoted[1]);
                    });
                }
            }
            if (match[2]) imports.add(match[2]);
            if (match[4]) imports.add(match[4]);
        }

        while ((match = exportRegex.exec(content)) !== null) {
            exports.add(match[1]);
        }

        if (imports.size > 0) {
            this.importMap.set(filePath, imports);
        }
        if (exports.size > 0) {
            this.exportMap.set(filePath, exports);
        }
    }

    private buildModules(filePaths: string[]): ModuleInfo[] {
        const modules = new Map<string, ModuleInfo>();

        for (const filePath of filePaths) {
            const relativePath = path.relative(this.workspacePath, filePath);
            const dir = path.dirname(relativePath);
            const moduleName = dir || 'root';

            if (!modules.has(moduleName)) {
                const moduleType = this.determineModuleType(dir, relativePath);
                modules.set(moduleName, {
                    name: moduleName,
                    path: dir,
                    type: moduleType,
                    files: [],
                    dependencies: [],
                    exports: []
                });
            }

            const module = modules.get(moduleName)!;
            module.files.push(relativePath);

            // Add dependencies from imports
            const imports = this.importMap.get(relativePath);
            if (imports) {
                for (const imp of imports) {
                    if (!imp.startsWith('.') && !imp.startsWith('/')) {
                        // External dependency
                        if (!module.dependencies.includes(imp)) {
                            module.dependencies.push(imp);
                        }
                    }
                }
            }

            // Add exports
            const exports = this.exportMap.get(relativePath);
            if (exports) {
                for (const exp of exports) {
                    if (!module.exports.includes(exp)) {
                        module.exports.push(exp);
                    }
                }
            }
        }

        return Array.from(modules.values());
    }

    private determineModuleType(dir: string, filePath: string): ModuleInfo['type'] {
        const lowerPath = filePath.toLowerCase();
        const lowerDir = dir.toLowerCase();

        if (lowerPath.includes('test') || lowerDir.includes('test') || lowerDir.includes('spec')) {
            return 'test';
        }
        if (lowerPath.includes('config') || lowerDir.includes('config')) {
            return 'config';
        }
        if (lowerPath.includes('service') || lowerDir.includes('service')) {
            return 'service';
        }
        if (lowerPath.includes('util') || lowerPath.includes('helper') || lowerDir.includes('util')) {
            return 'util';
        }
        if (lowerPath.includes('component') || lowerDir.includes('component')) {
            return 'component';
        }
        return 'module';
    }

    private buildComponents(filePaths: string[]): ComponentInfo[] {
        const components: ComponentInfo[] = [];

        for (const filePath of filePaths) {
            const relativePath = path.relative(this.workspacePath, filePath);
            const content = this.fileCache.get(filePath);
            if (!content) continue;

            const dir = path.dirname(relativePath);
            const moduleName = dir || 'root';

            // Extract components from file
            const fileComponents = this.extractComponents(content, relativePath, moduleName);
            components.push(...fileComponents);
        }

        return components;
    }

    private extractComponents(content: string, filePath: string, module: string): ComponentInfo[] {
        const components: ComponentInfo[] = [];
        const ext = path.extname(filePath).toLowerCase();

        if (['.ts', '.js', '.tsx', '.jsx'].includes(ext)) {
            // Extract classes, functions, interfaces
            const classRegex = /(?:export\s+)?(?:default\s+)?class\s+(\w+)/g;
            const functionRegex = /(?:export\s+)?(?:default\s+)?function\s+(\w+)/g;
            const interfaceRegex = /(?:export\s+)?interface\s+(\w+)/g;
            const componentRegex = /(?:export\s+)?(?:default\s+)?(?:const|let)\s+(\w+)\s*[:=]\s*(?:\(|React\.(?:FC|Component))/g;

            let match;
            while ((match = classRegex.exec(content)) !== null) {
                components.push({
                    name: match[1],
                    file: filePath,
                    type: 'class',
                    module,
                    dependencies: Array.from(this.importMap.get(filePath) || []),
                    exports: []
                });
            }

            while ((match = functionRegex.exec(content)) !== null) {
                components.push({
                    name: match[1],
                    file: filePath,
                    type: 'function',
                    module,
                    dependencies: Array.from(this.importMap.get(filePath) || []),
                    exports: []
                });
            }

            while ((match = interfaceRegex.exec(content)) !== null) {
                components.push({
                    name: match[1],
                    file: filePath,
                    type: 'interface',
                    module,
                    dependencies: Array.from(this.importMap.get(filePath) || []),
                    exports: []
                });
            }

            while ((match = componentRegex.exec(content)) !== null) {
                components.push({
                    name: match[1],
                    file: filePath,
                    type: 'component',
                    module,
                    dependencies: Array.from(this.importMap.get(filePath) || []),
                    exports: []
                });
            }
        }

        return components;
    }

    private buildDependencyEdges(): DependencyEdge[] {
        const edges: DependencyEdge[] = [];

        for (const [filePath, imports] of this.importMap.entries()) {
            for (const imp of imports) {
                // Try to resolve to a file in the workspace
                const resolved = this.resolveImport(imp, filePath);
                if (resolved) {
                    edges.push({
                        from: filePath,
                        to: resolved,
                        type: 'import',
                        file: filePath
                    });
                } else {
                    // External dependency
                    edges.push({
                        from: filePath,
                        to: imp,
                        type: 'import',
                        file: filePath
                    });
                }
            }
        }

        return edges;
    }

    private resolveImport(importPath: string, fromFile: string): string | null {
        // Simple resolution - try common patterns
        if (importPath.startsWith('.') || importPath.startsWith('/')) {
            const fromDir = path.dirname(fromFile);
            const resolved = path.resolve(this.workspacePath, fromDir, importPath);
            
            // Try with extensions
            const extensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.go'];
            for (const ext of extensions) {
                if (fs.existsSync(resolved + ext)) {
                    return path.relative(this.workspacePath, resolved + ext);
                }
            }
            if (fs.existsSync(resolved)) {
                return path.relative(this.workspacePath, resolved);
            }
        }

        return null;
    }
}

