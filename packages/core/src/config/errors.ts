/** Thrown by the config loaders: a missing or unreadable file, or content that fails its schema. */
export class ConfigError extends Error {
  /** The file (relative to the repository root) that failed, when there is one. */
  file: string | null;

  constructor(message: string, file: string | null = null) {
    super(message);
    this.name = 'ConfigError';
    this.file = file;
  }
}
