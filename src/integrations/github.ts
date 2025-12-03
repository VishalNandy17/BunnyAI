import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

export interface GitHubFile {
    filename: string;
    status: 'added' | 'modified' | 'removed' | 'renamed';
    additions: number;
    deletions: number;
    changes: number;
    patch?: string;
    blob_url: string;
    raw_url: string;
}

export interface GitHubPR {
    number: number;
    title: string;
    body: string;
    state: string;
    user: {
        login: string;
    };
    head: {
        ref: string;
        sha: string;
    };
    base: {
        ref: string;
        sha: string;
    };
    created_at: string;
    updated_at: string;
}

export interface GitHubPRComment {
    id: number;
    body: string;
    user: {
        login: string;
    };
    created_at: string;
    path?: string;
    line?: number;
    position?: number;
}

export interface GitHubReviewComment {
    id: number;
    body: string;
    path: string;
    line: number;
    side: 'LEFT' | 'RIGHT';
    start_line?: number;
    start_side?: 'LEFT' | 'RIGHT';
}

export class GitHubAPI {
    private baseUrl = 'https://api.github.com';
    private token: string | undefined;

    constructor(token?: string) {
        this.token = token;
    }

    setToken(token: string): void {
        this.token = token;
    }

    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        if (!this.token) {
            throw new Error('GitHub token not set. Please configure your GitHub personal access token.');
        }

        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'BunnyAI-Pro',
            ...options.headers
        };

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            return await response.json() as T;
        } catch (error) {
            Logger.error('GitHub API request failed', error);
            throw error;
        }
    }

    async getPR(owner: string, repo: string, prNumber: number): Promise<GitHubPR> {
        return this.request<GitHubPR>(`/repos/${owner}/${repo}/pulls/${prNumber}`);
    }

    async getPRFiles(owner: string, repo: string, prNumber: number): Promise<GitHubFile[]> {
        return this.request<GitHubFile[]>(`/repos/${owner}/${repo}/pulls/${prNumber}/files`);
    }

    async getPRComments(owner: string, repo: string, prNumber: number): Promise<GitHubPRComment[]> {
        return this.request<GitHubPRComment[]>(`/repos/${owner}/${repo}/issues/${prNumber}/comments`);
    }

    async getPRReviewComments(owner: string, repo: string, prNumber: number): Promise<GitHubReviewComment[]> {
        return this.request<GitHubReviewComment[]>(`/repos/${owner}/${repo}/pulls/${prNumber}/comments`);
    }

    async createPRComment(
        owner: string,
        repo: string,
        prNumber: number,
        body: string
    ): Promise<GitHubPRComment> {
        return this.request<GitHubPRComment>(`/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ body })
        });
    }

    async createPRReviewComment(
        owner: string,
        repo: string,
        prNumber: number,
        body: string,
        path: string,
        line: number,
        side: 'LEFT' | 'RIGHT' = 'RIGHT',
        startLine?: number,
        startSide?: 'LEFT' | 'RIGHT'
    ): Promise<GitHubReviewComment> {
        const comment: any = {
            body,
            path,
            line,
            side
        };

        if (startLine !== undefined) {
            comment.start_line = startLine;
            comment.start_side = startSide || 'LEFT';
        }

        return this.request<GitHubReviewComment>(`/repos/${owner}/${repo}/pulls/${prNumber}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(comment)
        });
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.request('/user');
            return true;
        } catch {
            return false;
        }
    }
}

