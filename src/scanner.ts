import process from "node:process";

import { globbyStream, Options as GlobbyGlobOptions } from "globby";
import { read } from "to-vfile";
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
  mdType: mdDefaultType,
  mdFileExts: mdDefaultFileExts,
  caseSensitive: false,
  globConcurrency: 0,
};

interface GlobOptions extends GlobbyGlobOptions {
  readonly cwd: string;
}

// Small wrapper around globby to yield VFile objects
async function* readGlob(
  patterns: ReadonlyArray<string>,
  options: GlobOptions,
): AsyncGenerator<VFile> {
  const filePaths = globbyStream(patterns, options);

  for await (const filePath of filePaths) {
    yield read({ cwd: options.cwd, path: String(filePath) });
  }
}

export async function* scanFiles(
  includeGlobs: ReadonlyArray<string>,
  excludeGlobs: ReadonlyArray<string>,
  options?: Partial<ScanOptions>,
): AsyncGenerator<ScanResult> {
  const mergedOptions: ScanOptions = {
    ...scanOptionsDefaults,
    basePath: process.cwd(),
    ...options,
  };

  const globOptions: GlobOptions = {
    cwd: mergedOptions.basePath,
    // The intent is clearer with a plain slice.
    // eslint-disable-next-line unicorn/prefer-spread
    ignore: excludeGlobs.slice(),
    caseSensitiveMatch: mergedOptions.caseSensitive,
    onlyFiles: true,
  };
  if (mergedOptions.globConcurrency > 0) {
    globOptions.concurrency = mergedOptions.globConcurrency;
  }

  const glob = readGlob(includeGlobs, globOptions);
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
