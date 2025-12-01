export interface IRequestConfig {
    timeout: number;
    headers: Record<string, string>;
}

export interface IResponseData {
    status: number;
    body: any;
}
