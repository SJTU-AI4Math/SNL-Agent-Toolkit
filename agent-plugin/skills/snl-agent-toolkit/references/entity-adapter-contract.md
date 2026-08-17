# Entity adapter contract

The shared Plugin surface delegates storage operations to one adapter. A host adapter must expose asynchronous `list`, `get`, `apply`, and `validate` methods.

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
