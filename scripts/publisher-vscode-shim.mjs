// Node filesystem transport for the unmodified fixed76 native readers.
// No SNL parsing, validation, activation, input projection or graph logic here.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
export const FileType = { Unknown: 0, File: 1, Directory: 2, SymbolicLink: 64 };
export class Uri {
  constructor(value) { this.url = new URL(value); this.scheme = this.url.protocol.slice(0, -1); this.fsPath = fileURLToPath(this.url); this.path = this.url.pathname; }
  static file(value) { return new Uri(pathToFileURL(path.resolve(value))); }
  static parse(value) { return new Uri(value); }
  static joinPath(uri, ...parts) { return Uri.file(path.join(uri.fsPath, ...parts)); }
  toString() { return this.url.href; }
}
export class Disposable { constructor(fn = () => {}) { this.dispose = fn; } }
export class EventEmitter {
  event = () => new Disposable();
  fire() {}
  dispose() {}
}
export const workspace = {
  fs: {
    readFile: uri => fs.readFile(uri.fsPath),
    readDirectory: async uri => (await fs.readdir(uri.fsPath, { withFileTypes: true })).map(e => [e.name, e.isDirectory() ? FileType.Directory : e.isSymbolicLink() ? FileType.SymbolicLink : FileType.File]),
    stat: async uri => { const s = await fs.stat(uri.fsPath); return { type: s.isDirectory() ? FileType.Directory : FileType.File, ctime: s.ctimeMs, mtime: s.mtimeMs, size: s.size }; },
    // Authoring writes are prohibited in this reader harness.
    writeFile() { throw new Error('native reader attempted a workspace write'); },
    createDirectory() { throw new Error('native reader attempted a workspace mkdir'); },
    delete() { throw new Error('native reader attempted a workspace delete'); },
    rename() { throw new Error('native reader attempted a workspace rename'); },
  },
  getConfiguration: () => ({ get: (_key, fallback) => fallback }),
};
export const env = { language: 'en' };
export const window = { activeColorTheme: { kind: 2 } };
export const ColorThemeKind = { Light: 1, Dark: 2, HighContrast: 3, HighContrastLight: 4 };
