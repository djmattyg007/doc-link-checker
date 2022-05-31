import { mdDefaultFileExts, mdDefaultType } from "./filetypes.js";

export { ScanOptions, ScanResult, scanFiles } from "./scanner.js";

export type { PositionRef, Position, Link, Heading } from "./types.js";

export const markdownOptions = {
  mdDefaultFileExts,
  mdDefaultType,
};

export {
  VerifyLinksOptions,
  FileCheckResponse,
  AnchorCheckResponse,
  VerifyLinkFileError,
  VerifyLinkAnchorError,
  verifyLinks,
} from "./checker/links.js";

export type { MarkdownType, ScanMarkdownOptions } from "./markdown/types.js";
export { scanFileForLinks } from "./markdown/link.js";
export { scanFileForHeadings } from "./markdown/heading.js";
