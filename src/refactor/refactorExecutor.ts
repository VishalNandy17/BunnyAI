import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/logger';

export interface RefactorEdit {
    file: string;
    oldText?: string;
    newText?: string;
    range?: {
        start: number;
        end: number;
    };
    description?: string;
}

export interface RefactorMove {
    from: string;
    to: string;
    reason?: string;
}

export interface RefactorCreate {
    file: string;
    content: string;
    description?: string;
}

export interface RefactorPlan {
    edits: RefactorEdit[];
    moves?: RefactorMove[];
    creates?: RefactorCreate[];
    summary?: string;
}

export interface RefactorValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    conflicts: Array<{
        file: string;
        reason: string;
    }>;
}

export class RefactorExecutor {
    private workspacePath: string;

    constructor(workspacePath: string) {
        this.workspacePath = workspacePath;
    }

    /**
     * Validate a refactor plan before execution
     */
    async validatePlan(plan: RefactorPlan): Promise<RefactorValidationResult> {
        const errors: string[] = [];
        const warnings: string[] = [];
        const conflicts: Array<{ file: string; reason: string }> = [];

        // Validate edits
        for (const edit of plan.edits) {
            const filePath = this.resolveFilePath(edit.file);
            
            if (!fs.existsSync(filePath)) {
                errors.push(`File does not exist: ${edit.file}`);
                continue;
            }

            // Check if file is read-only or in use
            try {
                const stats = fs.statSync(filePath);
                if (stats.isDirectory()) {
                    errors.push(`Path is a directory, not a file: ${edit.file}`);
                }
            } catch (error) {
                errors.push(`Cannot access file: ${edit.file}`);
            }

            // Validate range if provided
            if (edit.range) {
                if (edit.range.start < 0 || edit.range.end < edit.range.start) {
                    errors.push(`Invalid range in file: ${edit.file}`);
                }
            }

            // Check if oldText matches current content (for safety)
            if (edit.oldText) {
                try {
                    const currentContent = fs.readFileSync(filePath, 'utf-8');
                    if (edit.range) {
                        const rangeContent = currentContent.substring(edit.range.start, edit.range.end);
                        if (rangeContent !== edit.oldText) {
                            warnings.push(`Content mismatch in ${edit.file}. File may have been modified.`);
                            conflicts.push({
                                file: edit.file,
                                reason: 'File content has changed since plan was generated'
                            });
                        }
                    } else if (!currentContent.includes(edit.oldText)) {
                        warnings.push(`Old text not found in ${edit.file}. File may have been modified.`);
                        conflicts.push({
                            file: edit.file,
                            reason: 'Expected content not found in file'
                        });
                    }
                } catch (error) {
                    errors.push(`Cannot read file for validation: ${edit.file}`);
                }
            }
        }

        // Validate moves
        if (plan.moves) {
            for (const move of plan.moves) {
                const fromPath = this.resolveFilePath(move.from);
                const toPath = this.resolveFilePath(move.to);

                if (!fs.existsSync(fromPath)) {
                    errors.push(`Source file does not exist: ${move.from}`);
                }

                if (fs.existsSync(toPath)) {
                    errors.push(`Target file already exists: ${move.to}`);
                }

                // Check if target directory exists
                const toDir = path.dirname(toPath);
                if (!fs.existsSync(toDir)) {
                    warnings.push(`Target directory does not exist: ${path.dirname(move.to)}. Will be created.`);
                }
            }
        }

        // Validate creates
        if (plan.creates) {
            for (const create of plan.creates) {
                const filePath = this.resolveFilePath(create.file);

                if (fs.existsSync(filePath)) {
                    errors.push(`File already exists: ${create.file}`);
                }

                // Check if directory exists
                const dir = path.dirname(filePath);
                if (!fs.existsSync(dir)) {
                    warnings.push(`Directory does not exist: ${path.dirname(create.file)}. Will be created.`);
                }
            }
        }

        // Check for external import breaks
        const importBreakWarnings = await this.checkImportBreaks(plan);
        warnings.push(...importBreakWarnings);

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            conflicts
        };
    }

    /**
     * Check if refactoring might break external imports
     */
    private async checkImportBreaks(plan: RefactorPlan): Promise<string[]> {
        const warnings: string[] = [];

        // Check moves for potential import breaks
        if (plan.moves) {
            for (const move of plan.moves) {
                // If moving a file, check if other files import it
                const relativeFrom = path.relative(this.workspacePath, this.resolveFilePath(move.from));
                const relativeTo = path.relative(this.workspacePath, this.resolveFilePath(move.to));

                // Simple check: if the relative path changes significantly, imports might break
                if (relativeFrom !== relativeTo) {
                    warnings.push(`Moving ${move.from} to ${move.to} may break imports. Review dependent files.`);
                }
            }
        }

        return warnings;
    }

    /**
     * Apply a refactor plan using VS Code WorkspaceEdit
     */
    async executePlan(
        plan: RefactorPlan,
        selectedEdits?: number[],
        selectedMoves?: number[],
        selectedCreates?: number[]
    ): Promise<{ success: boolean; applied: number; errors: string[] }> {
        const workspaceEdit = new vscode.WorkspaceEdit();
        const errors: string[] = [];
        let applied = 0;

        try {
            // Apply edits
            const editsToApply = selectedEdits 
                ? plan.edits.filter((_, idx) => selectedEdits.includes(idx))
                : plan.edits;

            for (const edit of editsToApply) {
                try {
                    const fileUri = vscode.Uri.file(this.resolveFilePath(edit.file));
                    
                    if (edit.range && edit.newText !== undefined) {
                        // Range-based edit
                        const document = await vscode.workspace.openTextDocument(fileUri);
                        const startPos = document.positionAt(edit.range.start);
                        const endPos = document.positionAt(edit.range.end);
                        const range = new vscode.Range(startPos, endPos);
                        workspaceEdit.replace(fileUri, range, edit.newText);
                        applied++;
                    } else if (edit.oldText && edit.newText !== undefined) {
                        // Text-based edit (find and replace)
                        const document = await vscode.workspace.openTextDocument(fileUri);
                        const content = document.getText();
                        const index = content.indexOf(edit.oldText);
                        
                        if (index !== -1) {
                            const startPos = document.positionAt(index);
                            const endPos = document.positionAt(index + edit.oldText.length);
                            const range = new vscode.Range(startPos, endPos);
                            workspaceEdit.replace(fileUri, range, edit.newText);
                            applied++;
                        } else {
                            errors.push(`Could not find old text in ${edit.file}`);
                        }
                    } else if (edit.newText !== undefined) {
                        // Full file replacement (use with caution)
                        const document = await vscode.workspace.openTextDocument(fileUri);
                        const fullRange = new vscode.Range(
                            document.positionAt(0),
                            document.positionAt(document.getText().length)
                        );
                        workspaceEdit.replace(fileUri, fullRange, edit.newText);
                        applied++;
                    }
                } catch (error) {
                    errors.push(`Failed to apply edit to ${edit.file}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }

            // Apply moves
            const movesToApply = selectedMoves
                ? (plan.moves || []).filter((_, idx) => selectedMoves.includes(idx))
                : plan.moves || [];

            for (const move of movesToApply) {
                try {
                    const fromUri = vscode.Uri.file(this.resolveFilePath(move.from));
                    const toUri = vscode.Uri.file(this.resolveFilePath(move.to));

                    // Ensure target directory exists
                    const toDir = path.dirname(toUri.fsPath);
                    if (!fs.existsSync(toDir)) {
                        fs.mkdirSync(toDir, { recursive: true });
                    }

                    workspaceEdit.renameFile(fromUri, toUri, { overwrite: false });
                    applied++;
                } catch (error) {
                    errors.push(`Failed to move ${move.from} to ${move.to}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }

            // Apply creates
            const createsToApply = selectedCreates
                ? (plan.creates || []).filter((_, idx) => selectedCreates.includes(idx))
                : plan.creates || [];

            for (const create of createsToApply) {
                try {
                    const fileUri = vscode.Uri.file(this.resolveFilePath(create.file));

                    // Ensure directory exists
                    const dir = path.dirname(fileUri.fsPath);
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }

                    workspaceEdit.createFile(fileUri, { ignoreIfExists: false });
                    workspaceEdit.insert(fileUri, new vscode.Position(0, 0), create.content);
                    applied++;
                } catch (error) {
                    errors.push(`Failed to create ${create.file}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }

            // Apply all edits atomically
            const success = await vscode.workspace.applyEdit(workspaceEdit);

            if (!success) {
                errors.push('Failed to apply workspace edit. Some changes may have been rejected.');
            }

            return {
                success: errors.length === 0 && success,
                applied,
                errors
            };
        } catch (error) {
            Logger.error('Failed to execute refactor plan', error);
            errors.push(`Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return {
                success: false,
                applied,
                errors
            };
        }
    }

    /**
     * Generate a diff preview for an edit
     */
    async getEditDiff(edit: RefactorEdit): Promise<string | null> {
        try {
            const filePath = this.resolveFilePath(edit.file);
            
            if (!fs.existsSync(filePath)) {
                return null;
            }

            const currentContent = fs.readFileSync(filePath, 'utf-8');
            let newContent = currentContent;

            if (edit.range && edit.newText !== undefined) {
                newContent = currentContent.substring(0, edit.range.start) + 
                           edit.newText + 
                           currentContent.substring(edit.range.end);
            } else if (edit.oldText && edit.newText !== undefined) {
                newContent = currentContent.replace(edit.oldText, edit.newText);
            } else if (edit.newText !== undefined) {
                newContent = edit.newText;
            }

            // Simple diff generation (could be enhanced with a proper diff library)
            return this.generateSimpleDiff(currentContent, newContent);
        } catch (error) {
            Logger.error(`Failed to generate diff for ${edit.file}`, error);
            return null;
        }
    }

    /**
     * Simple diff generator (line-based)
     */
    private generateSimpleDiff(oldText: string, newText: string): string {
        const oldLines = oldText.split('\n');
        const newLines = newText.split('\n');
        const diff: string[] = [];

        let i = 0, j = 0;
        while (i < oldLines.length || j < newLines.length) {
            if (i >= oldLines.length) {
                diff.push(`+ ${newLines[j]}`);
                j++;
            } else if (j >= newLines.length) {
                diff.push(`- ${oldLines[i]}`);
                i++;
            } else if (oldLines[i] === newLines[j]) {
                diff.push(`  ${oldLines[i]}`);
                i++;
                j++;
            } else {
                // Check if line was moved or changed
                const nextMatch = newLines.slice(j + 1).indexOf(oldLines[i]);
                if (nextMatch !== -1 && nextMatch < 3) {
                    // Line moved down
                    diff.push(`+ ${newLines[j]}`);
                    j++;
                } else {
                    diff.push(`- ${oldLines[i]}`);
                    diff.push(`+ ${newLines[j]}`);
                    i++;
                    j++;
                }
            }
        }

        return diff.join('\n');
    }

    /**
     * Resolve file path relative to workspace
     */
    private resolveFilePath(filePath: string): string {
        if (path.isAbsolute(filePath)) {
            return filePath;
        }
        return path.resolve(this.workspacePath, filePath);
    }
}

