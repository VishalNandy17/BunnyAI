import { BaseParser } from './BaseParser';
import { IRoute } from '../types';

export class NestJSParser extends BaseParser {
    supports(languageId: string): boolean {
        return languageId === 'typescript';
    }

    async parse(content: string): Promise<IRoute[]> {
        return [];
    }
}
