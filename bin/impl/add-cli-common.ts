import { promises as fs } from 'node:fs';

class DraftReadError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'DraftReadError';
  }
}

class DraftJsonError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'DraftJsonError';
  }
}

export async function readDraftJson(file: string): Promise<unknown> {
  let text: string;
  try {
    text = await fs.readFile(file, 'utf8');
  } catch (error) {
    throw new DraftReadError(
      `Could not read draft ${file}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new DraftJsonError(
      `Invalid JSON in draft ${file}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

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
  if (error instanceof DraftJsonError) return failure('input.invalid-json', message);
  if (error instanceof DraftReadError) return failure('input.read-failed', message);
  return failure('workspace.write-failed', message);
}

export function emitHelp(usageText: string, asJson: boolean): void {
  if (asJson) {
    process.stdout.write(`${JSON.stringify({ status: 'help', usage: usageText }, null, 2)}\n`);
  } else {
    process.stdout.write(`${usageText}\n`);
  }
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
