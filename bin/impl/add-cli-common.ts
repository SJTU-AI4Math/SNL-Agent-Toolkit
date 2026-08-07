export interface AgentCliFailure {
  status: 'error';
  code: 'usage' | 'input.invalid-json' | 'input.read-failed' | 'workspace.write-failed';
  message: string;
}

export function wantsJson(argv: readonly string[]): boolean {
  return argv.includes('--json');
}

export function failure(code: AgentCliFailure['code'], message: string): AgentCliFailure {
  return { status: 'error', code, message };
}

export function failureFromError(error: unknown): AgentCliFailure {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof SyntaxError) return failure('input.invalid-json', message);
  if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return failure('input.read-failed', message);
  return failure('workspace.write-failed', message);
}

export function emitFailure(
  value: AgentCliFailure,
  asJson: boolean,
  usageText?: string,
): void {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    return;
  }
  process.stderr.write(`${value.message}${usageText ? `\n\n${usageText}` : ''}\n`);
}
