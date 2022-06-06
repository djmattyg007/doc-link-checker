export const mdTypes = ["commonmark", "gfm"] as const;
export type MarkdownType = typeof mdTypes[number];

export interface ScanMarkdownOptions {
  readonly mdType: MarkdownType;
}
