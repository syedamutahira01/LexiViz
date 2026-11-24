export function textHash(text: string): string;
export function parseEnv(text: string): Record<string, string>;
export function fixedCues(lessons: any[]): any[];
export function planJobs(lessons: any[], languages: { code: string }[], manifest: { entries: Record<string, any> }, settings: { provider: string; voice: string }): { jobs: { key: string; cueId: string; text: string; hash: string }[]; upToDate: number };
export const providers: Record<string, { name: string; synth(a: any): Promise<Buffer> }>;
