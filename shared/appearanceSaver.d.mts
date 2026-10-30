export type SaveStatus = 'pending' | 'saving' | 'saved' | 'error';
export interface AppearanceSaver<T> { stage(value: T): void; flush(): Promise<void>; stop(): void }
export function createAppearanceSaver<T>(options: { save(value: T): Promise<T>; onStatus(status: SaveStatus, error?: unknown): void; onSaved(value: T): void; delay?: number }): AppearanceSaver<T>;
