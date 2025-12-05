declare module "../../src/jswasm/vfs/opfs/installer/index.mjs" {
  export function createInstallOpfsVfsContext(sqlite3: unknown): {
    installOpfsVfs: (options: { proxyUri: string }) => Promise<void>;
  };
}
