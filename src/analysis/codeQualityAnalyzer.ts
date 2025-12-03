import * as ts from 'typescript';
import * as vscode from 'vscode';

export interface FunctionMetric {
    name: string;
    startLine: number;
    endLine: number;
    cyclomatic: number;
    loc: number;
    nestingDepth: number;
    maintainability: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
}

export interface FileQualityReport {
    filePath: string;
    summary: {
        avgCyclomatic: number;
        maxCyclomatic: number;
        worstFunction?: string;
    };
    functions: FunctionMetric[];
}

export class CodeQualityAnalyzer {
    analyzeDocument(document: vscode.TextDocument): FileQualityReport {
        return this.analyzeCode(document.getText(), document.uri.fsPath || document.uri.toString());
    }

    analyzeCode(code: string, filePath = 'in-memory.ts'): FileQualityReport {
        const sourceFile = ts.createSourceFile(
            filePath,
            code,
            ts.ScriptTarget.Latest,
            true,
            filePath.endsWith('.tsx') || filePath.endsWith('.jsx')
                ? ts.ScriptKind.TSX
                : ts.ScriptKind.TS
        );

        const functions: FunctionMetric[] = [];

        const visit = (node: ts.Node) => {
            if (this.isFunctionLike(node)) {
                const metric = this.computeMetrics(node as ts.FunctionLikeDeclaration, sourceFile);
                if (metric) {
                    functions.push(metric);
                }
            }
            ts.forEachChild(node, visit);
        };

        visit(sourceFile);

        const summary = this.buildSummary(functions);

        return {
            filePath,
            summary,
            functions
        };
    }

    private isFunctionLike(node: ts.Node): node is ts.FunctionLikeDeclaration {
        switch (node.kind) {
            case ts.SyntaxKind.FunctionDeclaration:
            case ts.SyntaxKind.FunctionExpression:
            case ts.SyntaxKind.MethodDeclaration:
            case ts.SyntaxKind.ArrowFunction:
            case ts.SyntaxKind.Constructor:
            case ts.SyntaxKind.GetAccessor:
            case ts.SyntaxKind.SetAccessor:
                return true;
            default:
                return false;
        }
    }

    private computeMetrics(
        node: ts.FunctionLikeDeclaration,
        sourceFile: ts.SourceFile
    ): FunctionMetric | undefined {
        if (!node.body) {
            return undefined;
        }

        const name = this.getFunctionName(node);
        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
        const loc = end.line - start.line + 1;

        let cyclomatic = 1;
        let maxDepth = 0;

        const incrementCyclomatic = (amount = 1) => {
            cyclomatic += amount;
        };

        const controlFlowNodes = new Set<ts.SyntaxKind>([
            ts.SyntaxKind.IfStatement,
            ts.SyntaxKind.ForStatement,
            ts.SyntaxKind.ForInStatement,
            ts.SyntaxKind.ForOfStatement,
            ts.SyntaxKind.WhileStatement,
            ts.SyntaxKind.DoStatement,
            ts.SyntaxKind.SwitchStatement,
            ts.SyntaxKind.TryStatement,
            ts.SyntaxKind.CatchClause
        ]);

        const visit = (current: ts.Node, depth: number) => {
            switch (current.kind) {
                case ts.SyntaxKind.IfStatement:
                case ts.SyntaxKind.ForStatement:
                case ts.SyntaxKind.ForInStatement:
                case ts.SyntaxKind.ForOfStatement:
                case ts.SyntaxKind.WhileStatement:
                case ts.SyntaxKind.DoStatement:
                case ts.SyntaxKind.CaseClause:
                case ts.SyntaxKind.CatchClause:
                case ts.SyntaxKind.ConditionalExpression:
                    incrementCyclomatic();
                    break;
                case ts.SyntaxKind.SwitchStatement: {
                    const switchNode = current as ts.SwitchStatement;
                    incrementCyclomatic(Math.max(0, switchNode.caseBlock.clauses.length - 1));
                    break;
                }
                case ts.SyntaxKind.BinaryExpression: {
                    const binary = current as ts.BinaryExpression;
                    if (
                        binary.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
                        binary.operatorToken.kind === ts.SyntaxKind.BarBarToken
                    ) {
                        incrementCyclomatic();
                    }
                    break;
                }
            }

            const isControl = controlFlowNodes.has(current.kind);
            const nextDepth = isControl ? depth + 1 : depth;
            if (nextDepth > maxDepth) {
                maxDepth = nextDepth;
            }

            ts.forEachChild(current, (child) => visit(child, nextDepth));
        };

        visit(node.body, 0);

        const maintainability = this.gradeMaintainability(cyclomatic, loc, maxDepth);

        return {
            name,
            startLine: start.line + 1,
            endLine: end.line + 1,
            cyclomatic,
            loc,
            nestingDepth: maxDepth,
            maintainability
        };
    }

    private getFunctionName(node: ts.FunctionLikeDeclaration): string {
        if (node.name && ts.isIdentifier(node.name)) {
            return node.name.text;
        }

        if (ts.isMethodDeclaration(node) && node.name) {
            return node.name.getText();
        }

        if (ts.isConstructorDeclaration(node)) {
            return 'constructor';
        }

        // Attempt to infer from variable assignment (e.g., const fn = () => {})
        const parent = node.parent;
        if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
            return parent.name.text;
        }

        if (ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) {
            return parent.name.text;
        }

        return 'anonymous';
    }

    private gradeMaintainability(
        cyclomatic: number,
        loc: number,
        nestingDepth: number
    ): 'A' | 'B' | 'C' | 'D' | 'E' | 'F' {
        if (cyclomatic <= 5 && loc <= 30 && nestingDepth <= 2) {
            return 'A';
        }
        if (cyclomatic <= 8 && loc <= 50 && nestingDepth <= 3) {
            return 'B';
        }
        if (cyclomatic <= 12 && loc <= 75 && nestingDepth <= 4) {
            return 'C';
        }
        if (cyclomatic <= 15 && loc <= 90 && nestingDepth <= 5) {
            return 'D';
        }
        if (cyclomatic <= 20 && loc <= 120 && nestingDepth <= 6) {
            return 'E';
        }
        return 'F';
    }

    private buildSummary(functions: FunctionMetric[]): FileQualityReport['summary'] {
        if (functions.length === 0) {
            return {
                avgCyclomatic: 0,
                maxCyclomatic: 0
            };
        }

        const totalCyclomatic = functions.reduce((sum, func) => sum + func.cyclomatic, 0);
        const maxCyclomatic = Math.max(...functions.map((func) => func.cyclomatic));
        const getRank = (grade: FunctionMetric['maintainability']) => {
            const order: Record<FunctionMetric['maintainability'], number> = {
                A: 1,
                B: 2,
                C: 3,
                D: 4,
                E: 5,
                F: 6
            };
            return order[grade];
        };

        const worst = functions.reduce((prev, curr) => {
            if (!prev) {
                return curr;
            }
            const prevRank = getRank(prev.maintainability);
            const currRank = getRank(curr.maintainability);
            if (currRank > prevRank) {
                return curr;
            }
            if (currRank === prevRank && curr.cyclomatic > prev.cyclomatic) {
                return curr;
            }
            return prev;
        });

        return {
            avgCyclomatic: parseFloat((totalCyclomatic / functions.length).toFixed(2)),
            maxCyclomatic,
            worstFunction: worst?.name
        };
    }
}


