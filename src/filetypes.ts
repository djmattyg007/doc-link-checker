import type { MarkdownType } from "./markdown";

export const mdFileExts: ReadonlySet<string> = new Set([".md", ".markdown"]);
export const mdDefaultType: MarkdownType = "commonmark";
