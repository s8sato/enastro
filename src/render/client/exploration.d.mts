export interface ExplorationEvent {
  id: string;
  status: string;
  ts: number;
}

export interface ExplorationState {
  snapshot: Record<string, string>;
  log: ExplorationEvent[];
  snapshotUpdatedAt: number;
}

export const STORAGE_KEY: string;

export const CURSOR_STORAGE_KEY: string;

export const DRAWER_STORAGE_KEY: string;

export const SNAPSHOT_CURSOR_TS: number;

export function loadState(): ExplorationState;

export function saveState(state: ExplorationState): boolean;

export function appendEvent(
  state: ExplorationState,
  id: string,
  status: string,
): { state: ExplorationState; ok: boolean; error?: unknown };

export function computeStatusAsOf(
  state: ExplorationState,
  cursorTs?: number,
): Map<string, string>;

export function getLastEventTimestamp(
  log: ExplorationEvent[],
  id: string,
  cursorTs?: number,
): number | undefined;

export function isNowTs(log: ExplorationEvent[], ts: number): boolean;

export function resetLogAt(log: ExplorationEvent[], cursorTs: number): ExplorationEvent[];

export function squashStateUntil(state: ExplorationState, cursorTs: number): ExplorationState;

export function loadCursor(): number | null;

export function saveCursor(cursorTs: number | null): boolean;

export function loadDrawerOpen(): boolean;

export function saveDrawerOpen(open: boolean): boolean;

export function parseModifiedAt(formatted: unknown): number | undefined;

export function getStatusSnapshot(cursorTs?: number): Map<string, string>;
