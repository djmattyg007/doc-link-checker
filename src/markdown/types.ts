export type MarkdownType = "commonmark" | "gfm";

export interface ScanMarkdownOptions {
  readonly mdType: MarkdownType;
}
