import * as ts from 'typescript';
import { BaseParser } from './BaseParser';
import { IRoute } from '../types';
import { Logger } from '../utils/logger';

export class ExpressParser extends BaseParser {
    private routerInstances: Map<string, string> = new Map(); // routerName -> basePath

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
            
            // First pass: identify router instances
            this.routerInstances.clear();
            this.identifyRouters(sourceFile, content);

            const visit = (node: ts.Node) => {
                try {
                    // Handle app.method() patterns
                    if (ts.isCallExpression(node)) {
                        const expression = node.expression;
                        
                        // Check for app.get(), app.post(), etc.
                        if (ts.isPropertyAccessExpression(expression)) {
                            const methodName = expression.name.text.toLowerCase();
                            
                            if (httpMethods.includes(methodName)) {
                                const routesFromNode = this.extractRoutesFromCall(node, methodName, sourceFile, '');
                                routes.push(...routesFromNode);
                            }
                        }
                        // Handle router.method() patterns: router.get('/path', ...)
                        else if (ts.isIdentifier(expression)) {
                            const routerName = expression.text;
                            if (this.routerInstances.has(routerName)) {
                                const basePath = this.routerInstances.get(routerName) || '';
                                const propertyAccess = node.parent;
                                if (propertyAccess && ts.isPropertyAccessExpression(propertyAccess)) {
                                    const methodName = propertyAccess.name.text.toLowerCase();
                                    if (httpMethods.includes(methodName)) {
                                        const routesFromNode = this.extractRoutesFromCall(node, methodName, sourceFile, basePath);
                                        routes.push(...routesFromNode);
                                    }
                                }
                            }
                        }
                    }
                    // Handle app.use('/prefix', router) patterns
                    else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
                        if (node.expression.name.text === 'use') {
                            this.extractRouterMount(node, sourceFile, content);
                        }
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

    private identifyRouters(sourceFile: ts.SourceFile, content: string): void {
        const visit = (node: ts.Node) => {
            // Look for: const router = express.Router();
            if (ts.isVariableDeclaration(node)) {
                const name = node.name;
                if (ts.isIdentifier(name)) {
                    const varName = name.text;
                    const init = node.initializer;
                    
                    if (init && ts.isCallExpression(init)) {
                        const expr = init.expression;
                        if (ts.isPropertyAccessExpression(expr) && 
                            expr.name.text === 'Router') {
                            // Found a router instance
                            this.routerInstances.set(varName, '');
                        }
                    }
                }
            }
            
            ts.forEachChild(node, visit);
        };
        
        visit(sourceFile);
    }

    private extractRouterMount(node: ts.CallExpression, sourceFile: ts.SourceFile, content: string): void {
        const args = node.arguments;
        if (args.length >= 2) {
            const prefixArg = args[0];
            const routerArg = args[1];
            
            let prefix = '';
            if (ts.isStringLiteral(prefixArg)) {
                prefix = prefixArg.text;
            }
            
            if (ts.isIdentifier(routerArg)) {
                const routerName = routerArg.text;
                if (this.routerInstances.has(routerName)) {
                    this.routerInstances.set(routerName, prefix);
                }
            }
        }
    }

    private extractRoutesFromCall(
        node: ts.CallExpression | ts.Node,
        methodName: string,
        sourceFile: ts.SourceFile,
        basePath: string
    ): IRoute[] {
        const routes: IRoute[] = [];
        
        // Handle both direct calls and nested calls
        let callNode: ts.CallExpression | null = null;
        if (ts.isCallExpression(node)) {
            callNode = node;
        } else if (node.parent && ts.isCallExpression(node.parent)) {
            callNode = node.parent;
        }
        
        if (!callNode) {
            return routes;
        }

        const args = callNode.arguments;
        
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
                    // Handle template literal text parts
                    if (span.literal && ts.isTemplateMiddle(span.literal)) {
                        path += span.literal.text;
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
                // Combine base path (from router mount) with route path
                const fullPath = basePath + (path.startsWith('/') ? path : '/' + path);
                const { line } = sourceFile.getLineAndCharacterOfPosition(callNode.getStart());
                
                // Extract route parameters from path
                const pathParams = this.extractPathParams(fullPath);
                params = [...params, ...pathParams];

                routes.push({
                    method: methodName.toUpperCase(),
                    path: fullPath,
                    handler: this.getHandlerName(args),
                    line: line,
                    params: params.length > 0 ? params : undefined
                });
            }
        }

        return routes;
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
                    } else if (ts.isArrowFunction(lastElement) || ts.isFunctionExpression(lastElement)) {
                        return 'anonymous';
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
