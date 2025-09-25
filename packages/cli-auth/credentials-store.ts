import path from 'node:path';
import fs from 'node:fs';
import { homedir } from 'node:os';
import XDGAppPaths from 'xdg-app-paths';
import { z } from 'zod/mini';

const Credentials = z.object({
  /** An `access_token` obtained using the OAuth Device Authorization flow.  */
  token: z.optional(z.string()),
  /** A `refresh_token` obtained using the OAuth Device Authorization flow. */
  refreshToken: z.optional(z.string().check(z.minLength(1))),
  /**
   * The absolute time (seconds) when the {@link Credentials.token} expires.
   * Used to optimistically check if the token is still valid.
   */
  expiresAt: z.optional(z.number()),
  /** Whether to skip writing the credentials to disk during {@link CredentialsStore.update} */
  skipWrite: z.optional(z.boolean()),
  '// Note': z.optional(z.string()),
  '// Docs': z.optional(z.string()),
});

export type Credentials = z.infer<typeof Credentials>;

/** Returns whether a directory exists */
function isDirectory(path: string): boolean {
  try {
    return fs.lstatSync(path).isDirectory();
  } catch (_) {
    // We don't care which kind of error occured, it isn't a directory anyway.
    return false;
  }
}

/** Returns in which directory the config should be present */
function getGlobalPathConfig(dir: string): string {
  const vercelDirectories = XDGAppPaths(dir).dataDirs();

  const possibleConfigPaths = [
    ...vercelDirectories, // latest vercel directory
    path.join(homedir(), '.now'), // legacy config in user's home directory
    ...XDGAppPaths('now').dataDirs(), // legacy XDG directory
  ];

  // The customPath flag is the preferred location,
  // followed by the vercel directory,
  // followed by the now directory.
  // If none of those exist, use the vercel directory.
  return (
    possibleConfigPaths.find(configPath => isDirectory(configPath)) ||
    vercelDirectories[0]
  );
}

export function CredentialsStore(dir: string) {
  const configPath = path.join(getGlobalPathConfig(dir), 'auth.json');
  return {
    configPath,
    get(): Credentials {
      return Credentials.parse(JSON.parse(fs.readFileSync(configPath, 'utf8')));
    },
    /** Update the credentials store. If `skipWrite` is set, the update will be skipped. */
    update(config: Partial<Credentials>): void {
      if (config.skipWrite) return;
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', {
        mode: 0o600,
      });
    },
  };
}
