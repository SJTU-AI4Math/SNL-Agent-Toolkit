export type PluginMetadataMap = Record<string, Record<string, unknown>>;

export function generatedMetadata(root?: string): Promise<PluginMetadataMap>;
export function writeGeneratedMetadata(root?: string): Promise<void>;
