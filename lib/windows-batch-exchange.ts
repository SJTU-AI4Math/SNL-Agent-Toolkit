import { spawn } from 'node:child_process';
import path from 'node:path';
import { createInterface } from 'node:readline';

// The two published names stay on their preimages until the single KTM
// commit. Closing the sole transaction handle before commit aborts all moves.
const script = String.raw`
$ErrorActionPreference = 'Stop'
$phase = 'open'
try {
  Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

public static class SnlBatchExchange {
    [DllImport("ktmw32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    static extern SafeFileHandle CreateTransaction(IntPtr security, IntPtr uow, uint options,
        uint isolation, uint flags, uint timeout, string description);
    [DllImport("ktmw32.dll", SetLastError = true)]
    static extern bool CommitTransaction(SafeFileHandle transaction);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool MoveFileTransactedW(string source, string destination, IntPtr progress,
        IntPtr data, uint flags, SafeFileHandle transaction);

    public static SafeFileHandle Open(string live, string staged) {
        var drive = new DriveInfo(Path.GetPathRoot(live));
        if (!String.Equals(drive.Name, Path.GetPathRoot(staged), StringComparison.OrdinalIgnoreCase) ||
            drive.DriveType != DriveType.Fixed || !String.Equals(drive.DriveFormat, "NTFS", StringComparison.OrdinalIgnoreCase))
            throw new Win32Exception(50);
        var tx = CreateTransaction(IntPtr.Zero, IntPtr.Zero, 0, 0, 0, 300000, "SNL batch exchange");
        if (!tx.IsInvalid) return tx;
        int error = Marshal.GetLastWin32Error();
        tx.Dispose();
        throw new Win32Exception(error);
    }

    public static void Move(string from, string to, SafeFileHandle tx) {
        // No copy, replace or delayed operation flags.
        if (!MoveFileTransactedW(from, to, IntPtr.Zero, IntPtr.Zero, 0, tx))
            throw new Win32Exception(Marshal.GetLastWin32Error());
    }

    public static void Commit(SafeFileHandle tx) {
        if (!CommitTransaction(tx)) throw new Win32Exception(Marshal.GetLastWin32Error());
    }
}
'@
  $request = [Console]::In.ReadLine() | ConvertFrom-Json
  $tx = [SnlBatchExchange]::Open($request.live, $request.staged)
  try {
    $phase = 'prepare'
    [SnlBatchExchange]::Move($request.live, $request.temporary, $tx)
    [SnlBatchExchange]::Move($request.staged, $request.live, $tx)
    [SnlBatchExchange]::Move($request.temporary, $request.staged, $tx)
    [Console]::Out.WriteLine('prepared')
    [Console]::Out.Flush()
    if ([Console]::In.ReadLine() -eq 'commit') {
      $phase = 'commit'
      [SnlBatchExchange]::Commit($tx)
      [Console]::Out.WriteLine('committed')
    }
  } finally {
    $tx.Dispose()
  }
} catch {
  $errorDetail = $_.Exception.GetBaseException()
  $nativeCode = if ($errorDetail -is [ComponentModel.Win32Exception]) { $errorDetail.NativeErrorCode } else { -1 }
  [Console]::Out.WriteLine("$phase $nativeCode")
  exit 1
}
`;

export class WindowsBatchExchangeError extends Error {
  constructor(readonly phase: string, readonly nativeCode: number, detail?: string) {
    super('Windows NTFS batch transaction failed during ' + phase + ' (Win32 ' + nativeCode + ')' + (detail ? ': ' + detail : '.'));
  }

  get unsupported(): boolean {
    return this.phase === 'open' || (this.phase === 'prepare' && [1, 50, 120, 6801, 6805].includes(this.nativeCode));
  }
}

/** The callback sees ordinary, pre-commit paths. Any exception aborts the kernel transaction. */
export async function exchangeWindowsBatch(
  live: string, staged: string, temporary: string, beforeCommit: () => Promise<void>,
): Promise<void> {
  const systemRoot = process.env.SystemRoot;
  if (!systemRoot || !/^[A-Za-z]:\\/.test(systemRoot)) throw new WindowsBatchExchangeError('open', 50);
  const executable = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const command = Buffer.from(script, 'utf16le').toString('base64');
  const child = spawn(executable, ['-NoProfile', '-NonInteractive', '-EncodedCommand', command], {
    windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
  });
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  const output = lines[Symbol.asyncIterator]();
  let failure: Error | undefined;
  child.stdin.on('error', error => { failure ??= error; });
  child.on('error', error => { failure ??= error; });
  // Wait for 'close', including on spawn failure. Abort cleanup may inspect the
  // live filesystem only after the helper has released its transaction handle.
  const closed = new Promise<void>(resolve => child.once('close', () => resolve()));
  let stderr = '';
  child.stderr.on('data', chunk => { if (stderr.length < 2048) stderr += chunk; });
  const next = async (success: string, phase: 'prepare' | 'commit') => {
    const timeout = setTimeout(() => {
      failure = new Error('Windows transaction helper timed out.');
      child.kill();
    }, phase === 'prepare' ? 30_000 : 300_000);
    const { value } = await output.next().finally(() => clearTimeout(timeout));
    if (value === success) return;
    const result = /^(open|prepare|commit) (-?\d+)$/.exec(value ?? '');
    if (result) throw new WindowsBatchExchangeError(result[1], Number(result[2]));
    throw new WindowsBatchExchangeError(phase, -1, failure?.message || stderr.trim().slice(0, 300));
  };
  // Legacy Windows PowerShell may decode redirected stdin in a non-UTF-8 code page.
  const request = JSON.stringify({ live, staged, temporary }).replace(/[^\x00-\x7f]/g,
    char => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'));
  try {
    child.stdin.write(request + '\n');
    await next('prepared', 'prepare');
    await beforeCommit();
    child.stdin.end('commit\n');
    await next('committed', 'commit');
    await closed;
  } finally {
    if (!child.stdin.writableEnded) child.stdin.end(); // EOF always aborts.
    await closed;
    lines.close();
  }
}
