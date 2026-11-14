import { spawn } from 'node:child_process';
import path from 'node:path';

// Open every component relative to a pinned ancestor, with reparse-point
// traversal and delete sharing disabled. Rename the checked handle itself.
const script = String.raw`
$ErrorActionPreference = 'Stop'
try {
  $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
  Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32.SafeHandles;

public static class SnlRename {
    const uint Read = 0x80000000, Delete = 0x10000, Synchronize = 0x100000;
    const uint OpenReparsePoint = 0x200000, BackupSemantics = 0x2000000;
    const uint ShareReadWrite = 3, Directory = 0x10, ReparsePoint = 0x400;

    [StructLayout(LayoutKind.Sequential)]
    struct UnicodeString { public ushort Length, Limit; public IntPtr Buffer; }
    [StructLayout(LayoutKind.Sequential)]
    struct ObjectAttributes {
        public int Length;
        public IntPtr Root, Name;
        public uint Attributes;
        public IntPtr Security, Quality;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct IoStatus { public IntPtr Status, Information; }
    [StructLayout(LayoutKind.Sequential)]
    struct FileInformation {
        public uint Attributes;
        public System.Runtime.InteropServices.ComTypes.FILETIME Creation, Access, Write;
        public uint Volume, SizeHigh, SizeLow, Links, IndexHigh, IndexLow;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern SafeFileHandle CreateFileW(string path, uint access, uint share,
        IntPtr security, uint disposition, uint flags, IntPtr template);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool GetFileInformationByHandle(SafeFileHandle file, out FileInformation info);
    [DllImport("ntdll.dll")]
    static extern int NtCreateFile(out SafeFileHandle handle, uint access, ref ObjectAttributes obj,
        out IoStatus status, IntPtr allocation, uint attributes, uint share, uint disposition,
        uint options, IntPtr ea, uint eaLength);
    [DllImport("ntdll.dll")]
    static extern int NtSetInformationFile(SafeFileHandle file, out IoStatus status,
        IntPtr buffer, uint length, int infoClass);
    [DllImport("ntdll.dll")]
    static extern int RtlNtStatusToDosError(int status);

    static IOException Error(string action, int code) {
        return new IOException(action + ": " + new Win32Exception(code).Message + " (" + code + ")");
    }

    static SafeFileHandle OpenChild(SafeFileHandle parent, string name, bool directory, bool rename) {
        if (name == "." || name == ".." || name.Length == 0 || name.IndexOfAny(new[] { ':', '/', '\\', '\0' }) >= 0)
            throw new IOException("Invalid Windows path component.");
        IntPtr chars = Marshal.StringToHGlobalUni(name);
        IntPtr unicode = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(UnicodeString)));
        try {
            ushort length = checked((ushort)(name.Length * 2));
            Marshal.StructureToPtr(new UnicodeString { Length = length, Limit = length, Buffer = chars }, unicode, false);
            var obj = new ObjectAttributes { Length = Marshal.SizeOf(typeof(ObjectAttributes)),
                Root = parent.DangerousGetHandle(), Name = unicode, Attributes = 0x40 };
            IoStatus status;
            SafeFileHandle handle;
            int result = NtCreateFile(out handle, Read | Synchronize | (rename ? Delete : 0u), ref obj, out status,
                IntPtr.Zero, 0, ShareReadWrite, 1 /* FILE_OPEN */,
                OpenReparsePoint | 0x20 /* FILE_SYNCHRONOUS_IO_NONALERT */ |
                (directory ? 1u : 0x40u), IntPtr.Zero, 0);
            GC.KeepAlive(parent);
            if (result >= 0) return handle;
            if (handle != null) handle.Dispose();
            throw Error("Cannot open " + name, RtlNtStatusToDosError(result));
        } finally {
            Marshal.FreeHGlobal(unicode);
            Marshal.FreeHGlobal(chars);
        }
    }

    static void Check(SafeFileHandle handle, bool directory, string volume = null, string id = null) {
        FileInformation info;
        if (!GetFileInformationByHandle(handle, out info))
            throw Error("Cannot inspect Windows file identity", Marshal.GetLastWin32Error());
        if ((info.Attributes & ReparsePoint) != 0 || ((info.Attributes & Directory) != 0) != directory)
            throw new IOException("Recovery refuses symbolic links, junctions and other reparse points.");
        ulong index = ((ulong)info.IndexHigh << 32) | info.IndexLow;
        // libuv may omit the volume number for path-based stats. The drive
        // and ancestors are already pinned, and file IDs are checked exactly.
        if (id != null && (index == 0 || (volume != "0" && info.Volume != UInt32.Parse(volume)) || index != UInt64.Parse(id)))
            throw new IOException("Recovery path changed concurrently.");
    }

    static SafeFileHandle OpenDirectory(string path, Dictionary<string, SafeFileHandle> held) {
        SafeFileHandle existing;
        if (held.TryGetValue(path, out existing)) return existing;
        var drive = Path.GetPathRoot(path);
        SafeFileHandle handle;
        if (path == drive) {
            if (drive.Length != 3 || drive[1] != ':' || new DriveInfo(drive).DriveType != DriveType.Fixed ||
                !String.Equals(new DriveInfo(drive).DriveFormat, "NTFS", StringComparison.OrdinalIgnoreCase))
                throw new IOException("Windows Library recovery requires a local NTFS drive.");
            handle = CreateFileW(drive, Read, ShareReadWrite, IntPtr.Zero, 3,
                OpenReparsePoint | BackupSemantics, IntPtr.Zero);
            if (handle.IsInvalid) {
                int code = Marshal.GetLastWin32Error();
                handle.Dispose();
                throw Error("Cannot open Windows drive", code);
            }
        } else {
            var parent = OpenDirectory(Path.GetDirectoryName(path), held);
            handle = OpenChild(parent, Path.GetFileName(path), true, false);
        }
        held.Add(path, handle);
        Check(handle, true);
        return handle;
    }

    public static void Move(string source, string targetParent, string targetName, bool directory,
        string sourceVolume, string sourceId, string parentVolume, string parentId) {
        var held = new Dictionary<string, SafeFileHandle>(StringComparer.OrdinalIgnoreCase);
        try {
            var from = OpenDirectory(Path.GetDirectoryName(source), held);
            var to = OpenDirectory(targetParent, held);
            Check(to, true, parentVolume, parentId);
            using (var subject = OpenChild(from, Path.GetFileName(source), directory, true)) {
                Check(subject, directory, sourceVolume, sourceId);
                var name = Encoding.Unicode.GetBytes(targetName);
                int lengthOffset = 2 * IntPtr.Size;
                // FILE_RENAME_INFORMATION with ReplaceIfExists=false.
                var bytes = new byte[lengthOffset + 4 + name.Length + 2];
                var parent = IntPtr.Size == 8 ? BitConverter.GetBytes(to.DangerousGetHandle().ToInt64()) :
                    BitConverter.GetBytes(to.DangerousGetHandle().ToInt32());
                Array.Copy(parent, 0, bytes, IntPtr.Size, IntPtr.Size);
                Array.Copy(BitConverter.GetBytes(name.Length), 0, bytes, lengthOffset, 4);
                Array.Copy(name, 0, bytes, lengthOffset + 4, name.Length);
                var buffer = Marshal.AllocHGlobal(bytes.Length);
                try {
                    Marshal.Copy(bytes, 0, buffer, bytes.Length);
                    IoStatus status;
                    int result = NtSetInformationFile(subject, out status, buffer, (uint)bytes.Length, 10);
                    GC.KeepAlive(to);
                    if (result < 0) throw Error("Cannot rename without replacing the destination", RtlNtStatusToDosError(result));
                } finally { Marshal.FreeHGlobal(buffer); }
            }
        } finally {
            foreach (var handle in held.Values) handle.Dispose();
        }
    }
}
'@
  [SnlRename]::Move($request.source, $request.parent, $request.name, $request.directory,
    $request.sourceVolume, $request.sourceId, $request.parentVolume, $request.parentId)
  [Console]::Out.WriteLine('ok')
} catch {
  [Console]::Error.WriteLine($_.Exception.GetBaseException().Message)
  exit 1
}
`;

export async function moveWindowsNoReplace(
    source: string, target: string, directory: boolean,
    expected: { dev: bigint; ino: bigint }, parent: { dev: bigint; ino: bigint },
): Promise<void> {
    const systemRoot = process.env.SystemRoot;
    if (!systemRoot || !/^[A-Za-z]:\\/.test(systemRoot)) throw new Error('Windows PowerShell could not be located.');
    const executable = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const encodedScript = Buffer.from(script, 'utf16le').toString('base64');
    const request = JSON.stringify({
        source, parent: path.dirname(target), name: path.basename(target), directory,
        sourceVolume: String(expected.dev), sourceId: String(expected.ino),
        parentVolume: String(parent.dev), parentId: String(parent.ino),
    });
    await new Promise<void>((resolve, reject) => {
        const child = spawn(executable, ['-NoProfile', '-NonInteractive', '-EncodedCommand', encodedScript], {
            windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], timeout: 30_000,
        });
        let out = '';
        let error = '';
        child.stdout.on('data', chunk => { out += chunk; });
        child.stderr.on('data', chunk => { if (error.length < 4096) error += chunk; });
        child.stdin.on('error', reject);
        child.once('error', reject);
        child.once('close', code => {
            if (code === 0 && out.trim() === 'ok') resolve();
            else {
                const plain = error.replace(/#< CLIXML\s*<Objs[^>]*>.*?<\/Objs>\s*/gs, '').trim();
                reject(new Error(plain || 'Windows no-replace rename did not complete.'));
            }
        });
        // Windows PowerShell's default redirected input encoding is not UTF-8.
        child.stdin.end(request.replace(/[^\x00-\x7f]/g, char => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0')));
    });
}
