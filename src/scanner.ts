import { readGlob, Options as GlobOptions } from "glob-reader";
import type { VFile } from "vfile";

import { mdFileExts, mdDefaultType } from "./filetypes.js";
import type { MarkdownType } from "./markdown/types";
import { scanFileForLinks as scanMdFile } from "./markdown/link.js";
import type { Link } from "./types";

export interface ScanOptions {
  readonly basePath: string;
  readonly caseSensitive: boolean;
  readonly mdType: MarkdownType;
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
  globConcurrency: 0,
};

export async function* scanFiles(
  includeGlobs: ReadonlyArray<string>,
  excludeGlobs: ReadonlyArray<string>,
  options?: Partial<ScanOptions>,
): AsyncGenerator<ScanResult> {
  const mergedOptions: ScanOptions = Object.assign({}, scanOptionsDefaults, options || {});

  const globOptions: GlobOptions = {
    cwd: mergedOptions.basePath,
    ignore: excludeGlobs.slice(),
    caseSensitiveMatch: mergedOptions.caseSensitive,
  };
  if (mergedOptions.globConcurrency > 0) {
    globOptions.concurrency = mergedOptions.globConcurrency;
  }

  const glob = readGlob(includeGlobs.slice(), globOptions);
  for await (const file of glob) {
    const fileExt = file.extname;
    if (!fileExt) {
      continue;
    }

    if (mdFileExts.has(fileExt)) {
      yield {
        file,
        links: scanMdFile(file, { mdType: mergedOptions.mdType } ),
      };
    }
  }
}
