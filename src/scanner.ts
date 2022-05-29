import { readGlob, Options as GlobOptions } from "glob-reader";
import type { VFile } from "vfile";

import { mdFileExts, mdDefaultType } from "./filetypes.js";
import type { MarkdownType } from "./markdown/types";
import { scanFileForLinks as scanMdFile } from "./markdown/link.js";
import type { LinkReference } from "./types";

export interface ScanOptions {
  readonly basePath: string;
  readonly caseSensitive: boolean;
  readonly mdType: MarkdownType;
  readonly globConcurrency: number;
}

export interface ScanResult {
  readonly path: VFile;
  readonly linkRefs: AsyncIterator<LinkReference>;
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
) {
  const mergedOptions: ScanOptions = Object.assign({}, scanOptionsDefaults, options || {});

  const globOptions: GlobOptions = {
    cwd: mergedOptions.basePath,
    ignore: excludeGlobs.slice(),
    encoding: "utf8",
  };
  // Waiting on this: https://github.com/bent10/glob-reader/issues/6
  // if (mergedOptions.globConcurrency > 0) {
  //   globOptions.concurrency = mergedOptions.globConcurrency;
  // }
  // if (mergedOptions.caseSensitive === true) {
  //   globOptions.caseSensitiveMatch = true;
  // }

  const glob = readGlob(includeGlobs.slice(), globOptions);
  for await (const file of glob) {
    const fileExt = file.extname;
    if (!fileExt) {
      continue;
    }

    if (mdFileExts.has(fileExt)) {
      yield {
        file,
        linkRefs: scanMdFile(file),
      };
    }
  }
}
