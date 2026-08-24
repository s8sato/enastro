export interface ExplorationEvent {
  id: string;
  status: string;
  ts: number;
}

export const STORAGE_KEY: string;

export function loadLog(): ExplorationEvent[];

export function appendEvent(
  log: ExplorationEvent[],
  id: string,
  status: string,
): { log: ExplorationEvent[]; ok: boolean; error?: unknown };

export function computeStatusAsOf(
  log: ExplorationEvent[],
  cursorTs?: number,
): Map<string, string>;

export function getLastEventTimestamp(
  log: ExplorationEvent[],
  id: string,
  cursorTs?: number,
): number | undefined;

export function resetLogAt(log: ExplorationEvent[], cursorTs: number): ExplorationEvent[];

export function pruneLogUntil(log: ExplorationEvent[], cursorTs: number): ExplorationEvent[];

export function parseModifiedAt(formatted: unknown): number | undefined;

export function getStatusSnapshot(cursorTs?: number): Map<string, string>;
