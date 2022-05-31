import { readGlob, Options as GlobOptions } from "glob-reader";
import type { VFile } from "vfile";

import { mdDefaultFileExts, mdDefaultType } from "./filetypes.js";
import type { MarkdownType } from "./markdown/types";
import { scanFileForLinks as scanMdFile } from "./markdown/link.js";
import type { Link } from "./types";

export interface ScanOptions {
  readonly basePath: string;
  readonly caseSensitive: boolean;
  readonly mdType: MarkdownType;
  readonly mdFileExts: ReadonlySet<string>;
  readonly globConcurrency: number;
}

export interface ScanResult {
  readonly file: VFile;
  readonly links: IterableIterator<Link>;
}

const scanOptionsDefaults: ScanOptions = {
  basePath: ".",
  caseSensitive: false,
  mdType: mdDefaultType,
  mdFileExts: mdDefaultFileExts,
  globConcurrency: 0,
};

export async function* scanFiles(
  includeGlobs: ReadonlyArray<string>,
  excludeGlobs: ReadonlyArray<string>,
  options?: Partial<ScanOptions>,
): AsyncGenerator<ScanResult> {
  const mergedOptions: ScanOptions = {
    ...scanOptionsDefaults,
    ...options,
  };

  const globOptions: GlobOptions = {
    cwd: mergedOptions.basePath,
    // The intent is clearer with a plain slice.
    // eslint-disable-next-line unicorn/prefer-spread
    ignore: excludeGlobs.slice(),
    caseSensitiveMatch: mergedOptions.caseSensitive,
  };
  if (mergedOptions.globConcurrency > 0) {
    globOptions.concurrency = mergedOptions.globConcurrency;
  }

  // The intent is clearer with a plain slice.
  // eslint-disable-next-line unicorn/prefer-spread
  const glob = readGlob(includeGlobs.slice(), globOptions);
  for await (const file of glob) {
    const fileExt = file.extname;
    if (!fileExt) {
      continue;
    }

    if (mergedOptions.mdFileExts.has(fileExt)) {
      yield {
        file,
        links: scanMdFile(file, { mdType: mergedOptions.mdType }),
      };
    }
  }
}
