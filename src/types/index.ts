export interface IParser {
    parse(content: string): Promise<IRoute[]>;
    supports(languageId: string): boolean;
}

export interface IRoute {
    method: string;
    path: string;
    handler: string;
    line: number;
    params?: string[];
}

export interface IRequest {
    id: string;
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: any;
    timestamp: number;
}

export interface IResponse {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    data: any;
    duration: number;
    size: number;
}

export interface IAIProvider {
    generateTests(code: string): Promise<string>;
    generateDocs(code: string): Promise<string>;
    analyzeError(error: string): Promise<string>;
}
