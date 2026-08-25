export const STORAGE_KEY: string;

export const DEFAULT_DIRECTION: string;

export function isValidDirection(value: string): boolean;

export function readStoredDirection(): string | undefined;

export function storeDirection(direction: string): boolean;

export function resolveParticleEndpoints<T>(direction: string, source: T, target: T): { from: T; to: T };
