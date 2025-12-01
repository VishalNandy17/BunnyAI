import * as ts from 'typescript';
import { BaseParser } from './BaseParser';
import { IRoute } from '../types';
import { Logger } from '../utils/logger';

export class ExpressParser extends BaseParser {
    supports(languageId: string): boolean {
        return languageId === 'typescript' || languageId === 'javascript';
    }

    async parse(content: string): Promise<IRoute[]> {
        try {
            const sourceFile = ts.createSourceFile(
                'temp.ts',
                content,
                ts.ScriptTarget.Latest,
                true
            );

            const routes: IRoute[] = [];
            const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'all'];

            const visit = (node: ts.Node) => {
                try {
                    // Handle app.method() patterns
                    if (ts.isCallExpression(node)) {
                        const expression = node.expression;
                        
                        // Check for app.get(), app.post(), etc.
                        if (ts.isPropertyAccessExpression(expression)) {
                            const methodName = expression.name.text.toLowerCase();
                            
                            if (httpMethods.includes(methodName)) {
                                const args = node.arguments;
                                
                                // First argument should be the path
                                if (args.length > 0) {
                                    const pathArg = args[0];
                                    let path: string | null = null;
                                    let params: string[] = [];

                                    // Handle string literals: app.get('/users', ...)
                                    if (ts.isStringLiteral(pathArg)) {
                                        path = pathArg.text;
                                    }
                                    // Handle template strings: app.get(`/users/${id}`, ...)
                                    else if (ts.isTemplateExpression(pathArg)) {
                                        path = pathArg.head.text;
                                        // Extract template parts for params
                                        pathArg.templateSpans.forEach(span => {
                                            if (ts.isIdentifier(span.expression)) {
                                                params.push(span.expression.text);
                                            }
                                        });
                                    }
                                    // Handle variable references: const path = '/users'; app.get(path, ...)
                                    else if (ts.isIdentifier(pathArg)) {
                                        // Try to find the variable definition
                                        const varName = pathArg.text;
                                        const sourceFileText = sourceFile.getFullText();
                                        const regex = new RegExp(`(const|let|var)\\s+${varName}\\s*=\\s*['"]([^'"]+)['"]`, 'g');
                                        const match = regex.exec(sourceFileText);
                                        if (match) {
                                            path = match[2];
                                        }
                                    }

                                    if (path) {
                                        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                                        
                                        // Extract route parameters from path
                                        const pathParams = this.extractPathParams(path);
                                        params = [...params, ...pathParams];

                                        routes.push({
                                            method: methodName.toUpperCase(),
                                            path: path,
                                            handler: this.getHandlerName(args),
                                            line: line,
                                            params: params.length > 0 ? params : undefined
                                        });
                                    }
                                }
                            }
                        }
                        // Handle router.method() patterns: router.get('/path', ...)
                        else if (ts.isIdentifier(expression)) {
                            // This might be a router instance
                            // We'll check if it's followed by a property access
                            // For now, we'll skip this as it requires more context
                        }
                    }
                    // Handle Router() patterns
                    else if (ts.isVariableDeclaration(node)) {
                        // Check for: const router = express.Router();
                        // This would require tracking router instances
                    }
                } catch (error) {
                    Logger.log(`Error parsing node at line ${sourceFile.getLineAndCharacterOfPosition(node.getStart()).line}: ${error}`);
                    // Continue parsing other nodes
                }

                ts.forEachChild(node, visit);
            };

            visit(sourceFile);
            
            // Remove duplicates (same method and path)
            const uniqueRoutes = this.removeDuplicates(routes);
            
            Logger.log(`Parsed ${uniqueRoutes.length} routes from file`);
            return uniqueRoutes;
        } catch (error) {
            Logger.error('Failed to parse Express routes', error);
            return [];
        }
    }

    private extractPathParams(path: string): string[] {
        const params: string[] = [];
        const paramRegex = /:(\w+)/g;
        let match;
        while ((match = paramRegex.exec(path)) !== null) {
            params.push(match[1]);
        }
        return params;
    }

    private getHandlerName(args: ts.NodeArray<ts.Node>): string {
        if (args.length > 1) {
            const handler = args[args.length - 1];
            if (ts.isIdentifier(handler)) {
                return handler.text;
            } else if (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler)) {
                return 'anonymous';
            } else if (ts.isArrayLiteralExpression(handler)) {
                // Middleware array - get the last handler
                const elements = handler.elements;
                if (elements.length > 0) {
                    const lastElement = elements[elements.length - 1];
                    if (ts.isIdentifier(lastElement)) {
                        return lastElement.text;
                    }
                }
            }
        }
        return 'handler';
    }

    private removeDuplicates(routes: IRoute[]): IRoute[] {
        const seen = new Set<string>();
        return routes.filter(route => {
            const key = `${route.method}:${route.path}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }
}
