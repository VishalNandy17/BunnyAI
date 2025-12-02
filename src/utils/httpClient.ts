import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { Logger } from './logger';

export interface HttpClientOptions {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: any;
    timeout?: number;
    /**
     * Maximum number of bytes allowed in the request body.
     * Defaults to HttpClient.DEFAULT_MAX_REQUEST_BODY_SIZE.
     */
    maxRequestBodyBytes?: number;
    /**
     * Maximum number of bytes allowed in the response body.
     * Defaults to HttpClient.DEFAULT_MAX_RESPONSE_SIZE.
     */
    maxResponseBytes?: number;
}

export interface HttpClientResponse {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    data: any;
    duration: number;
    size: number;
}

export class HttpClient {
    private static readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
    private static readonly DEFAULT_MAX_REQUEST_BODY_SIZE = 1 * 1024 * 1024; // 1MB
    private static readonly DEFAULT_MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10MB

    async request(options: HttpClientOptions): Promise<HttpClientResponse> {
        const startTime = Date.now();
        const url = new URL(options.url);

        // Only allow HTTP/HTTPS to avoid obvious SSRF-style issues
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            const duration = Date.now() - startTime;
            const message = `Unsupported URL protocol: ${url.protocol}`;
            Logger.error(message, new Error(message));
            throw {
                status: 0,
                statusText: 'Invalid URL',
                headers: {},
                data: { error: message },
                duration,
                size: 0
            } as HttpClientResponse;
        }
        const isHttps = url.protocol === 'https:';
        const httpModule = isHttps ? https : http;

        const maxRequestBodyBytes =
            options.maxRequestBodyBytes ?? HttpClient.DEFAULT_MAX_REQUEST_BODY_SIZE;
        const maxResponseBytes =
            options.maxResponseBytes ?? HttpClient.DEFAULT_MAX_RESPONSE_SIZE;

        return new Promise((resolve, reject) => {
            try {
                const requestOptions: https.RequestOptions = {
                    hostname: url.hostname,
                    port: url.port || (isHttps ? 443 : 80),
                    path: url.pathname + url.search,
                    method: options.method,
                    headers: {
                        'User-Agent': 'BunnyAI-Pro/1.0',
                        'Accept': 'application/json',
                        ...options.headers
                    },
                    timeout: options.timeout || HttpClient.DEFAULT_TIMEOUT
                };

                // Add Content-Type for POST/PUT/PATCH with body
                if (options.body && ['POST', 'PUT', 'PATCH'].includes(options.method)) {
                    const headers = requestOptions.headers as Record<string, string>;
                    if (!headers['Content-Type']) {
                        headers['Content-Type'] = 'application/json';
                    }
                }

                const req = httpModule.request(requestOptions, (res) => {
                    const responseHeaders: Record<string, string> = {};
                    Object.keys(res.headers).forEach(key => {
                        const value = res.headers[key];
                        responseHeaders[key] = Array.isArray(value) ? value.join(', ') : value || '';
                    });

                    let data = '';
                    let totalSize = 0;

                    res.on('data', (chunk: Buffer) => {
                        totalSize += chunk.length;

                        // Enforce maximum response size
                        if (totalSize > maxResponseBytes) {
                            const duration = Date.now() - startTime;
                            const error = new Error('Response exceeded maximum allowed size');
                            Logger.error('HTTP response too large', error);
                            res.destroy();
                            reject({
                                status: 0,
                                statusText: 'Response Too Large',
                                headers: {},
                                data: {
                                    error: `Response exceeded maximum size of ${maxResponseBytes} bytes`
                                },
                                duration,
                                size: totalSize
                            });
                            return;
                        }

                        data += chunk.toString();
                    });

                    res.on('end', () => {
                        const duration = Date.now() - startTime;
                        let parsedData: any = data;

                        // Try to parse JSON
                        const contentType = res.headers['content-type'] || '';
                        if (contentType.includes('application/json') && data) {
                            try {
                                parsedData = JSON.parse(data);
                            } catch (e) {
                                // Keep as string if JSON parse fails
                                parsedData = data;
                            }
                        }

                        resolve({
                            status: res.statusCode || 200,
                            statusText: res.statusMessage || 'OK',
                            headers: responseHeaders,
                            data: parsedData,
                            duration,
                            size: totalSize
                        });
                    });
                });

                req.on('error', (error: Error) => {
                    const duration = Date.now() - startTime;
                    Logger.error('HTTP request failed', error);
                    reject({
                        status: 0,
                        statusText: error.message || 'Network Error',
                        headers: {},
                        data: { error: error.message },
                        duration,
                        size: 0
                    });
                });

                req.on('timeout', () => {
                    req.destroy();
                    const duration = Date.now() - startTime;
                    const error = new Error('Request timeout');
                    Logger.error('HTTP request timeout', error);
                    reject({
                        status: 0,
                        statusText: 'Request Timeout',
                        headers: {},
                        data: { error: 'Request timeout after ' + (options.timeout || HttpClient.DEFAULT_TIMEOUT) + 'ms' },
                        duration,
                        size: 0
                    });
                });

                // Send request body if present
                if (options.body) {
                    const bodyString = typeof options.body === 'string'
                        ? options.body
                        : JSON.stringify(options.body);

                    const bodyBytes = Buffer.byteLength(bodyString, 'utf8');
                    if (bodyBytes > maxRequestBodyBytes) {
                        const duration = Date.now() - startTime;
                        const error = new Error('Request body exceeded maximum allowed size');
                        Logger.error('HTTP request body too large', error);
                        reject({
                            status: 0,
                            statusText: 'Request Entity Too Large',
                            headers: {},
                            data: {
                                error: `Request body exceeded maximum size of ${maxRequestBodyBytes} bytes`
                            },
                            duration,
                            size: 0
                        });
                        req.destroy();
                        return;
                    }

                    req.write(bodyString);
                }

                req.end();
            } catch (error: any) {
                const duration = Date.now() - startTime;
                Logger.error('HTTP request setup failed', error);
                reject({
                    status: 0,
                    statusText: error.message || 'Request Failed',
                    headers: {},
                    data: { error: error.message },
                    duration,
                    size: 0
                });
            }
        });
    }

    async get(url: string, headers?: Record<string, string>): Promise<HttpClientResponse> {
        return this.request({ method: 'GET', url, headers });
    }

    async post(url: string, body?: any, headers?: Record<string, string>): Promise<HttpClientResponse> {
        return this.request({ method: 'POST', url, body, headers });
    }

    async put(url: string, body?: any, headers?: Record<string, string>): Promise<HttpClientResponse> {
        return this.request({ method: 'PUT', url, body, headers });
    }

    async delete(url: string, headers?: Record<string, string>): Promise<HttpClientResponse> {
        return this.request({ method: 'DELETE', url, headers });
    }

    async patch(url: string, body?: any, headers?: Record<string, string>): Promise<HttpClientResponse> {
        return this.request({ method: 'PATCH', url, body, headers });
    }
}
