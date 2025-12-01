import { BaseParser } from './BaseParser';
import { IRoute } from '../types';

export class LaravelParser extends BaseParser {
    supports(languageId: string): boolean {
        return languageId === 'php';
    }

    async parse(content: string): Promise<IRoute[]> {
        return [];
    }
}
