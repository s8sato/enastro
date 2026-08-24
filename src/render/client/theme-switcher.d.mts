export interface ThemeInfo {
  id: string;
  label: string;
  accent: string;
}

export const THEMES: ThemeInfo[];

export const STORAGE_KEY: string;

export const DEFAULT_THEME: string;

export function isValidTheme(id: string): boolean;

export function readStoredTheme(): string | undefined;

export function storeTheme(id: string): boolean;

export function angleForIndex(index: number, total: number): number;

export function pointOnCircle(angleDegrees: number, radius: number): { x: number; y: number };
