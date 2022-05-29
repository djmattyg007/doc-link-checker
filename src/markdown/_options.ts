import type { MarkdownType, ScanMarkdownOptions } from "./types";

export const mdDefaultType: MarkdownType = "commonmark";

export const scanOptionsDefaults: ScanMarkdownOptions = {
  mdType: mdDefaultType,
};
