import { BaseParser } from './BaseParser';
import { IRoute } from '../types';

export class GraphQLParser extends BaseParser {
    supports(languageId: string): boolean {
        return languageId === 'graphql';
    }

    async parse(content: string): Promise<IRoute[]> {
        return [];
    }
}
