import type { SQLite3API } from "@wuchuheng/web-sqlite";

export interface OpfsSahpoolOptions {
  name?: string;
  directory?: string;
  initialCapacity?: number;
  clearOnInit?: boolean;
  verbosity?: number;
  forceReinitIfPreviouslyFailed?: boolean;
  $testThrowPhase1?: unknown;
  $testThrowPhase2?: unknown;
}

export interface OpfsSahpoolUtility {
  readonly vfsName: string;
  addCapacity(capacity: number): Promise<number>;
  reduceCapacity(capacity: number): Promise<number>;
  getCapacity(): number;
  getFileCount(): number;
  getFileNames(): string[];
  reserveMinimumCapacity(minimum: number): Promise<number>;
  exportFile(name: string): Promise<Uint8Array>;
  importDb(name: string, bytes: ArrayBuffer | ArrayBufferView): Promise<void>;
  wipeFiles(): Promise<void>;
  unlink(filename: string): Promise<void>;
  removeVfs(): Promise<void>;
  pauseVfs(): OpfsSahpoolUtility;
  unpauseVfs(): Promise<OpfsSahpoolUtility>;
  isPaused(): boolean;
  OpfsSAHPoolDb?: new (...args: unknown[]) => unknown;
}

export interface OpfsSahpoolInstaller {
  (options?: OpfsSahpoolOptions): Promise<OpfsSahpoolUtility>;
}

export type Sqlite3WithOpfsInstaller = SQLite3API & {
  installOpfsSAHPoolVfs: OpfsSahpoolInstaller;
};

export function createOpfsSahpoolInitializer(): (
  sqlite3: Sqlite3WithOpfsInstaller,
) => void;
