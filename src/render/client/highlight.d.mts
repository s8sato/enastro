export const HASH_KEY: string;

export function buildHighlightHash(query: string): string;

export function parseHighlightHash(hash: string): string[];

export function findMatchRanges(text: string, terms: string[]): { start: number; end: number }[];
