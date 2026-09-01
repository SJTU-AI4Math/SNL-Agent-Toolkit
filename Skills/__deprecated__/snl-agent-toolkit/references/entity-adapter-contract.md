# Entity adapter contract

The shared Plugin surface delegates storage operations to one adapter. A host adapter must expose asynchronous `list`, `get`, `apply`, and `validate` methods. It may additionally expose `renderEntry` and `renderLibraryTree`; adapters written against the earlier four-method contract remain loadable, and the corresponding projection tool returns a structured unsupported result when an optional method is absent.

## Entity identities

Supported `entityType` values are exactly:

- `entry-kind`, `macro-kind`
- `entry-package`, `macro-package`
- `entry`, `macro`
- `relationship`, `library`

IDs are canonical and case-sensitive. Macro IDs use the Toolkit's Package-qualified identity. Entry Package and Macro Package are separate projections of the same current Package manifest.

## Revisions and writes

`get` and `list` return opaque revision strings derived from the exact canonical entity value. `update` and `delete` require `expectedRevision`; a mismatch is a domain conflict and must not write. Writes must use the shared `.data-write.lock`, preserve unknown fields and file permissions, reject symlink traversal, and publish atomically.

## Result discipline

Return JSON-serializable values only. Domain invalid/not-found/conflict outcomes are structured results, not process crashes. Invocation, workspace, and internal failures may throw; MCP converts them to `isError: true` tool results.

## Workspace validation

`validate({root})` must inspect all eight entity families through their authoritative current readers. It must fail closed on unsupported versions, malformed payloads, inconsistent Package membership, dangling references, duplicate identities, or invalid Library topology. It must not write.

## Entry reading projection

When implemented, `renderEntry({ root, id })` returns directly assembled bare LaTeX and non-fatal notes for one canonical Entry id. It must parse `content.snl` against the active Macro catalog without emitting `\htmlData` wrappers. When the selected Macro style is `block`, it must emit `macro-name(rendered subtrees)` rather than compile the host-specific block template.

Missing Entries and malformed Entry content return structured `not-found` or `invalid` domain results. Workspace, invocation, and internal failures may still throw.

## Library Entry tree projection

When implemented, `renderLibraryTree(request)` returns one folder-style multiline string plus Library metadata. `request.language` selects localized Entry Kind names and titles. `includeEntryKind`, `includeNumber`, `includeTitle`, `includeEntryId`, and `includeCounterId` are independent optional booleans that default to true. Numbering must use branch reading order, explicit occurrence `counterId`, Entry Kind `defaultCounterName` fallback, and the Library counter hierarchy. An explicit `counterId` must resolve and duplicate Counter names are invalid because name fallback would be ambiguous. Placeholder nodes remain visible so they do not collapse the authored tree shape.
