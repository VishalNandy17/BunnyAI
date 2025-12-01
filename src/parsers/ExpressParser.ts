import * as ts from 'typescript';
import { BaseParser } from './BaseParser';
import { IRoute } from '../types';

export class ExpressParser extends BaseParser {
    supports(languageId: string): boolean {
        return languageId === 'typescript' || languageId === 'javascript';
    }

    async parse(content: string): Promise<IRoute[]> {
        const sourceFile = ts.createSourceFile(
            'temp.ts',
            content,
            ts.ScriptTarget.Latest,
            true
        );

        const routes: IRoute[] = [];

        const visit = (node: ts.Node) => {
            if (ts.isCallExpression(node)) {
                const expression = node.expression;
                if (ts.isPropertyAccessExpression(expression)) {
                    const methodName = expression.name.text;
                    if (['get', 'post', 'put', 'delete', 'patch'].includes(methodName)) {
                        const args = node.arguments;
                        if (args.length > 0 && ts.isStringLiteral(args[0])) {
                            const path = args[0].text;
                            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

                            routes.push({
                                method: methodName.toUpperCase(),
                                path: path,
                                handler: 'handler', // Simplified for now
                                line: line
                            });
                        }
                    }
                }
            }
            ts.forEachChild(node, visit);
        };

        visit(sourceFile);
        return routes;
    }
}
