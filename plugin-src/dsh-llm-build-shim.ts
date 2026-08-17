/** Minimal build-time surface used by @deepseek-ai/dsh-tools' schema helper. */
export class HarnessError extends Error {
  readonly code: string;

  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'HarnessError';
    this.code = code;
  }
}

export function assertNever(value: never, context?: string): never {
  throw new Error(`unreachable variant${context ? ` in ${context}` : ''}: ${String(value)}`);
}
