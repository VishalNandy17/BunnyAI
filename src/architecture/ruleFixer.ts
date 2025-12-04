import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { RuleViolation } from './ruleEngine';
import { RefactorExecutor, RefactorPlan, RefactorEdit, RefactorMove, RefactorCreate } from '../refactor/refactorExecutor';
import { AIProvider } from '../ai/AIProvider';
import { Logger } from '../utils/logger';

export class ArchitectureRuleFixer {
    private workspacePath: string;
    private executor: RefactorExecutor;
    private aiProvider: AIProvider;

    constructor(workspacePath: string) {
        this.workspacePath = workspacePath;
        this.executor = new RefactorExecutor(workspacePath);
        this.aiProvider = new AIProvider();
    }

    /**
     * Generate a fix plan for violations
     */
    async generateFixPlan(violations: RuleViolation[]): Promise<RefactorPlan> {
        const edits: RefactorEdit[] = [];
        const moves: RefactorMove[] = [];
        const creates: RefactorCreate[] = [];

        // Group violations by type
        const renameViolations = violations.filter(v => v.suggestedFix?.type === 'rename');
        const moveViolations = violations.filter(v => v.suggestedFix?.type === 'move');
        const createViolations = violations.filter(v => v.suggestedFix?.type === 'create');
        const reorganizeViolations = violations.filter(v => v.suggestedFix?.type === 'reorganize');

        // Handle renames
        for (const violation of renameViolations) {
            if (violation.file && violation.suggestedFix?.oldPath && violation.suggestedFix?.newPath) {
                // Rename is handled as a move
                moves.push({
                    from: violation.suggestedFix.oldPath,
                    to: violation.suggestedFix.newPath,
                    reason: violation.message
                });
            }
        }

        // Handle moves
        for (const violation of moveViolations) {
            if (violation.suggestedFix?.oldPath && violation.suggestedFix?.newPath) {
                moves.push({
                    from: violation.suggestedFix.oldPath,
                    to: violation.suggestedFix.newPath,
                    reason: violation.message
                });
            }
        }

        // Handle creates (directories)
        for (const violation of createViolations) {
            if (violation.suggestedFix?.newPath) {
                // Create a placeholder file to ensure directory is created
                const dirPath = path.join(this.workspacePath, violation.suggestedFix.newPath);
                const placeholderPath = path.join(dirPath, '.gitkeep');
                creates.push({
                    file: path.relative(this.workspacePath, placeholderPath),
                    content: '# This file ensures the directory is tracked by git\n',
                    description: `Create directory ${violation.suggestedFix.newPath}`
                });
            }
        }

        // Handle reorganize (import refactoring) - use AI
        if (reorganizeViolations.length > 0) {
            const importEdits = await this.generateImportFixes(reorganizeViolations);
            if (importEdits && importEdits.length > 0) {
                edits.push(...importEdits);
            }
        }

        return {
            edits: edits, // RefactorPlan requires edits to be non-optional
            moves: moves.length > 0 ? moves : undefined,
            creates: creates.length > 0 ? creates : undefined,
            summary: `Fix plan: ${edits.length} edits, ${moves.length} moves, ${creates.length} creates`
        };
    }

    /**
     * Generate import reorganization fixes using AI
     */
    private async generateImportFixes(violations: RuleViolation[]): Promise<RefactorEdit[]> {
        const edits: RefactorEdit[] = [];

        for (const violation of violations) {
            if (!violation.file) continue;

            try {
                const filePath = path.join(this.workspacePath, violation.file);
                if (!fs.existsSync(filePath)) continue;

                const content = fs.readFileSync(filePath, 'utf-8');
                
                // Build AI prompt for import reorganization
                const prompt = `You are fixing import organization issues in the following file:

File: ${violation.file}
Issue: ${violation.message}
Suggested Fix: ${violation.suggestedFix?.description}

Current code:
\`\`\`
${content.substring(0, 2000)}
\`\`\`

Please reorganize the imports to fix the issue. Return the refactored code with properly organized imports.

Return ONLY the refactored code, no explanations.`;

                const aiResponse = await this.aiProvider.reviewAndRefactor(content, undefined, undefined);
                
                // Extract code from response
                const refactoredCode = this.extractCodeFromResponse(aiResponse);
                
                if (refactoredCode && refactoredCode !== content) {
                    edits.push({
                        file: violation.file,
                        oldText: content,
                        newText: refactoredCode,
                        description: violation.suggestedFix?.description || 'Reorganize imports'
                    });
                }
            } catch (error) {
                Logger.error(`Failed to generate import fix for ${violation.file}`, error);
            }
        }

        return edits;
    }

    /**
     * Extract code from AI response
     */
    private extractCodeFromResponse(response: string): string {
        // Try to extract code block
        const codeBlockMatch = response.match(/```[\w]*\n([\s\S]*?)```/);
        if (codeBlockMatch) {
            return codeBlockMatch[1].trim();
        }

        // Try to extract from REFACTOR tags
        const refactorMatch = response.match(/\[REFACTOR\]([\s\S]*?)\[\/REFACTOR\]/i);
        if (refactorMatch) {
            return refactorMatch[1].trim();
        }

        // Return as-is if no markers found
        return response.trim();
    }

    /**
     * Apply fixes using RefactorExecutor
     */
    async applyFixes(plan: RefactorPlan): Promise<{ success: boolean; applied: number; errors: string[] }> {
        // Validate plan first
        const validation = await this.executor.validatePlan(plan);
        
        if (!validation.valid) {
            return {
                success: false,
                applied: 0,
                errors: validation.errors
            };
        }

        // Apply plan
        return await this.executor.executePlan(plan);
    }
}

