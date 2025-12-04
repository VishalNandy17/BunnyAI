import { WorkspaceScanResult, FileInfo } from './workspaceScanner';
import { DependencyGraph } from './depGraph';
import { AIProvider } from '../ai/AIProvider';
import { Logger } from '../utils/logger';
import { RefactorPlan, RefactorEdit, RefactorMove, RefactorCreate } from './refactorExecutor';

export interface RefactorProposal {
    filesToRefactor: Array<{
        file: string;
        reason: string;
        priority: 'high' | 'medium' | 'low';
    }>;
    filesToMove: Array<{
        file: string;
        currentPath: string;
        suggestedPath: string;
        reason: string;
    }>;
    newStructure: {
        description: string;
        recommendedFolders: string[];
    };
    codeTransformations: Array<{
        file: string;
        transformation: string;
        description: string;
    }>;
    architectureImprovements: string[];
}

export interface RefactorAnalysisResult {
    complexModules: Array<{
        files: string[];
        averageComplexity: number;
        maxComplexity: number;
        reason: string;
    }>;
    circularDependencies: string[][];
    architectureSmells: Array<{
        type: string;
        description: string;
        affectedFiles: string[];
        severity: 'high' | 'medium' | 'low';
    }>;
    aiProposal?: RefactorProposal;
    refactorPlan?: RefactorPlan;
}

export class RefactorAnalyzer {
    private aiProvider: AIProvider;

    constructor() {
        this.aiProvider = new AIProvider();
    }

    async analyzeForRefactor(
        scanResult: WorkspaceScanResult,
        depGraph: DependencyGraph
    ): Promise<RefactorAnalysisResult> {
        // Identify complex modules
        const complexModules = this.identifyComplexModules(scanResult.files);

        // Identify architecture smells
        const architectureSmells = this.identifyArchitectureSmells(scanResult, depGraph);

        // Generate AI proposal
        let aiProposal: RefactorProposal | undefined;
        try {
            aiProposal = await this.generateAIProposal(scanResult, depGraph, complexModules, architectureSmells);
        } catch (error) {
            Logger.error('Failed to generate AI refactor proposal', error);
        }

        // Generate executable refactor plan
        let refactorPlan: RefactorPlan | undefined;
        if (aiProposal) {
            try {
                refactorPlan = await this.generateRefactorPlan(scanResult, aiProposal);
            } catch (error) {
                Logger.error('Failed to generate refactor plan', error);
            }
        }

        return {
            complexModules,
            circularDependencies: depGraph.circularDependencies,
            architectureSmells,
            aiProposal,
            refactorPlan
        };
    }

    /**
     * Generate an executable RefactorPlan from the proposal
     */
    async generateRefactorPlan(
        scanResult: WorkspaceScanResult,
        proposal: RefactorProposal
    ): Promise<RefactorPlan> {
        const edits: RefactorEdit[] = [];
        const moves: RefactorMove[] = [];
        const creates: RefactorCreate[] = [];

        // Prepare file summaries for AI
        const fileSummaries: Array<{ path: string; summary: string; content: string }> = [];
        
        for (const refactorItem of proposal.filesToRefactor) {
            const fileInfo = scanResult.files.find(f => f.relativePath === refactorItem.file);
            if (fileInfo) {
                const summary = this.getFileSummary(fileInfo);
                fileSummaries.push({
                    path: refactorItem.file,
                    summary: summary,
                    content: fileInfo.content
                });
            }
        }

        // Generate actual code edits using AI
        for (const fileSummary of fileSummaries) {
            try {
                const edit = await this.generateFileEdit(fileSummary, proposal);
                if (edit) {
                    edits.push(edit);
                }
            } catch (error) {
                Logger.error(`Failed to generate edit for ${fileSummary.path}`, error);
            }
        }

        // Convert moves from proposal
        if (proposal.filesToMove) {
            for (const move of proposal.filesToMove) {
                moves.push({
                    from: move.currentPath,
                    to: move.suggestedPath,
                    reason: move.reason
                });
            }
        }

        return {
            edits,
            moves: moves.length > 0 ? moves : undefined,
            creates: creates.length > 0 ? creates : undefined,
            summary: `Refactoring plan: ${edits.length} edits, ${moves.length} moves`
        };
    }

    /**
     * Generate a code edit for a specific file using AI
     */
    private async generateFileEdit(
        fileSummary: { path: string; summary: string; content: string },
        proposal: RefactorProposal
    ): Promise<RefactorEdit | null> {
        const refactorItem = proposal.filesToRefactor.find(f => f.file === fileSummary.path);
        if (!refactorItem) {
            return null;
        }

        const transformation = proposal.codeTransformations?.find(t => t.file === fileSummary.path);

        const prompt = this.buildCodeEditPrompt(fileSummary, refactorItem, transformation);

        try {
            const aiResponse = await this.aiProvider.explainSecurityIssues(prompt);
            return this.parseCodeEditResponse(aiResponse, fileSummary);
        } catch (error) {
            Logger.error(`Failed to generate code edit for ${fileSummary.path}`, error);
            return null;
        }
    }

    /**
     * Build prompt for AI to generate code edits
     */
    private buildCodeEditPrompt(
        fileSummary: { path: string; summary: string; content: string },
        refactorItem: { file: string; reason: string; priority: string },
        transformation?: { file: string; transformation: string; description: string }
    ): string {
        return `You are an expert code refactoring assistant. Generate a refactored version of the following code.

File: ${fileSummary.path}
Reason for refactoring: ${refactorItem.reason}
Priority: ${refactorItem.priority}
${transformation ? `Transformation: ${transformation.transformation}\nDescription: ${transformation.description}` : ''}

Current code (first 200 lines):
\`\`\`
${fileSummary.summary}
\`\`\`

Provide the refactored code in the following JSON format:
{
  "oldText": "exact text to replace (from the code above)",
  "newText": "refactored code",
  "description": "what was changed and why"
}

Focus on:
- Improving code structure and readability
- Reducing complexity
- Following best practices
- Maintaining functionality

Return ONLY valid JSON, no markdown formatting.`;
    }

    /**
     * Parse AI response to extract code edit
     */
    private parseCodeEditResponse(
        aiResponse: string,
        fileSummary: { path: string; summary: string; content: string }
    ): RefactorEdit | null {
        try {
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    file: fileSummary.path,
                    oldText: parsed.oldText,
                    newText: parsed.newText,
                    description: parsed.description
                };
            }
        } catch (error) {
            Logger.error('Failed to parse code edit response', error);
        }
        return null;
    }

    /**
     * Get file summary (first 200 lines)
     */
    private getFileSummary(fileInfo: FileInfo): string {
        const lines = fileInfo.content.split('\n');
        return lines.slice(0, 200).join('\n');
    }

    private identifyComplexModules(files: FileInfo[]): Array<{
        files: string[];
        averageComplexity: number;
        maxComplexity: number;
        reason: string;
    }> {
        // Group files by directory
        const modules = new Map<string, FileInfo[]>();

        for (const file of files) {
            const dir = this.getDirectory(file.relativePath);
            if (!modules.has(dir)) {
                modules.set(dir, []);
            }
            modules.get(dir)!.push(file);
        }

        const complexModules: Array<{
            files: string[];
            averageComplexity: number;
            maxComplexity: number;
            reason: string;
        }> = [];

        for (const [dir, moduleFiles] of modules.entries()) {
            const filesWithComplexity = moduleFiles.filter(f => f.complexity);
            if (filesWithComplexity.length === 0) continue;

            const avgComplexity = filesWithComplexity.reduce(
                (sum, f) => sum + (f.complexity?.average || 0),
                0
            ) / filesWithComplexity.length;

            const maxComplexity = Math.max(
                ...filesWithComplexity.map(f => f.complexity?.max || 0)
            );

            if (avgComplexity > 10 || maxComplexity > 20) {
                complexModules.push({
                    files: moduleFiles.map(f => f.relativePath),
                    averageComplexity: Math.round(avgComplexity * 100) / 100,
                    maxComplexity,
                    reason: avgComplexity > 15
                        ? 'Very high average complexity'
                        : maxComplexity > 25
                        ? 'Contains extremely complex functions'
                        : 'High complexity module'
                });
            }
        }

        return complexModules.sort((a, b) => b.averageComplexity - a.averageComplexity).slice(0, 10);
    }

    private identifyArchitectureSmells(
        scanResult: WorkspaceScanResult,
        depGraph: DependencyGraph
    ): Array<{
        type: string;
        description: string;
        affectedFiles: string[];
        severity: 'high' | 'medium' | 'low';
    }> {
        const smells: Array<{
            type: string;
            description: string;
            affectedFiles: string[];
            severity: 'high' | 'medium' | 'low';
        }> = [];

        // Circular dependencies
        if (depGraph.circularDependencies.length > 0) {
            const allFilesInCycles = new Set<string>();
            depGraph.circularDependencies.forEach(cycle => {
                cycle.forEach(file => allFilesInCycles.add(file));
            });
            smells.push({
                type: 'Circular Dependency',
                description: `${depGraph.circularDependencies.length} circular dependency cycle(s) detected`,
                affectedFiles: Array.from(allFilesInCycles),
                severity: 'high'
            });
        }

        // Highly coupled modules
        if (depGraph.highlyCoupledModules.length > 0) {
            depGraph.highlyCoupledModules.slice(0, 5).forEach(module => {
                smells.push({
                    type: 'High Coupling',
                    description: `Module has ${Math.round(module.coupling * 100)}% external coupling`,
                    affectedFiles: module.files,
                    severity: module.coupling > 0.7 ? 'high' : 'medium'
                });
            });
        }

        // Orphaned files
        if (depGraph.orphanedFiles.length > 0) {
            smells.push({
                type: 'Orphaned Files',
                description: `${depGraph.orphanedFiles.length} file(s) with no dependencies or dependents`,
                affectedFiles: depGraph.orphanedFiles,
                severity: 'low'
            });
        }

        // Too many root files
        if (scanResult.rootFiles.length > 10) {
            smells.push({
                type: 'Flat Structure',
                description: `Too many files (${scanResult.rootFiles.length}) in root directory`,
                affectedFiles: scanResult.rootFiles,
                severity: 'medium'
            });
        }

        return smells;
    }

    private async generateAIProposal(
        scanResult: WorkspaceScanResult,
        depGraph: DependencyGraph,
        complexModules: Array<{ files: string[]; averageComplexity: number; maxComplexity: number; reason: string }>,
        architectureSmells: Array<{ type: string; description: string; affectedFiles: string[]; severity: 'high' | 'medium' | 'low' }>
    ): Promise<RefactorProposal> {
        // Prepare summary data for AI
        const summary = this.prepareSummaryForAI(scanResult, depGraph, complexModules, architectureSmells);

        const prompt = this.buildRefactorPrompt(summary);

        try {
            const aiResponse = await this.aiProvider.explainSecurityIssues(prompt);
            return this.parseAIResponse(aiResponse, scanResult);
        } catch (error) {
            Logger.error('AI refactor proposal generation failed', error);
            throw error;
        }
    }

    private prepareSummaryForAI(
        scanResult: WorkspaceScanResult,
        depGraph: DependencyGraph,
        complexModules: Array<{ files: string[]; averageComplexity: number; maxComplexity: number; reason: string }>,
        architectureSmells: Array<{ type: string; description: string; affectedFiles: string[]; severity: 'high' | 'medium' | 'low' }>
    ): string {
        const summary: string[] = [];

        summary.push(`# Workspace Analysis Summary\n`);
        summary.push(`**Total Files:** ${scanResult.totalFiles}`);
        summary.push(`**Languages:** ${Array.from(scanResult.languages.entries()).map(([lang, count]) => `${lang}: ${count}`).join(', ')}`);
        summary.push(`**Root Files:** ${scanResult.rootFiles.length}\n`);

        summary.push(`## Complex Modules (Top 5)\n`);
        complexModules.slice(0, 5).forEach((module, idx) => {
            summary.push(`${idx + 1}. ${module.files[0]} (avg: ${module.averageComplexity}, max: ${module.maxComplexity})`);
            summary.push(`   Files: ${module.files.slice(0, 3).join(', ')}${module.files.length > 3 ? '...' : ''}`);
        });

        summary.push(`\n## Circular Dependencies\n`);
        if (depGraph.circularDependencies.length > 0) {
            depGraph.circularDependencies.slice(0, 3).forEach((cycle, idx) => {
                summary.push(`${idx + 1}. ${cycle.join(' -> ')}`);
            });
        } else {
            summary.push('No circular dependencies detected.');
        }

        summary.push(`\n## Architecture Smells\n`);
        architectureSmells.forEach((smell, idx) => {
            summary.push(`${idx + 1}. [${smell.severity.toUpperCase()}] ${smell.type}: ${smell.description}`);
            summary.push(`   Affected: ${smell.affectedFiles.slice(0, 3).join(', ')}${smell.affectedFiles.length > 3 ? '...' : ''}`);
        });

        summary.push(`\n## File Structure Sample\n`);
        const sampleFiles = scanResult.files.slice(0, 20).map(f => ({
            path: f.relativePath,
            complexity: f.complexity ? `${f.complexity.average.toFixed(1)}/${f.complexity.max}` : 'N/A',
            imports: f.imports.length,
            exports: f.exports.length
        }));
        summary.push(JSON.stringify(sampleFiles, null, 2));

        return summary.join('\n');
    }

    private buildRefactorPrompt(summary: string): string {
        return `You are an expert software architect analyzing a codebase for refactoring opportunities.

${summary}

Based on this analysis, provide a comprehensive refactoring proposal in the following JSON format:

{
  "filesToRefactor": [
    {
      "file": "path/to/file.ts",
      "reason": "Why this file needs refactoring",
      "priority": "high|medium|low"
    }
  ],
  "filesToMove": [
    {
      "file": "current/path/file.ts",
      "currentPath": "current/path/file.ts",
      "suggestedPath": "new/path/file.ts",
      "reason": "Why this file should be moved"
    }
  ],
  "newStructure": {
    "description": "Recommended folder structure",
    "recommendedFolders": ["folder1", "folder2"]
  },
  "codeTransformations": [
    {
      "file": "path/to/file.ts",
      "transformation": "extract_function|split_module|rename|consolidate",
      "description": "What transformation to apply"
    }
  ],
  "architectureImprovements": [
    "Improvement 1",
    "Improvement 2"
  ]
}

Focus on:
1. Breaking circular dependencies
2. Reducing coupling
3. Improving module boundaries
4. Organizing files by feature/domain
5. Extracting complex code into smaller modules

Return ONLY valid JSON, no markdown formatting.`;
    }

    private parseAIResponse(aiResponse: string, scanResult: WorkspaceScanResult): RefactorProposal {
        try {
            // Try to extract JSON from response
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    filesToRefactor: parsed.filesToRefactor || [],
                    filesToMove: parsed.filesToMove || [],
                    newStructure: parsed.newStructure || { description: '', recommendedFolders: [] },
                    codeTransformations: parsed.codeTransformations || [],
                    architectureImprovements: parsed.architectureImprovements || []
                };
            }
        } catch (error) {
            Logger.error('Failed to parse AI response', error);
        }

        // Fallback: return empty proposal
        return {
            filesToRefactor: [],
            filesToMove: [],
            newStructure: { description: '', recommendedFolders: [] },
            codeTransformations: [],
            architectureImprovements: []
        };
    }

    private getDirectory(filePath: string): string {
        const dir = filePath.substring(0, filePath.lastIndexOf('/') || filePath.lastIndexOf('\\'));
        return dir || 'root';
    }
}

