import { promises as fs } from "fs";
import path from "path";

import isTextPath from "is-text-path";
import type { VFile } from "vfile";
import { read } from "to-vfile";

import { mdFileExts, mdDefaultType } from "../filetypes.js";
import type { MarkdownType } from "../markdown/types";
import { scanFileForHeadings as scanMdFileForHeadings } from "../markdown/heading.js";
import type { Link } from "../types";

export interface VerifyLinksOptions {
  readonly mdType: MarkdownType;
}

const verifyLinksOptionsDefaults: VerifyLinksOptions = {
  mdType: mdDefaultType,
};

export enum FileCheckResponse {
  SUCCESS = 0,
  FILE_NOT_EXISTS = 1,
  FILE_OUTSIDE_BASE = 2,
}

export enum AnchorCheckResponse {
  EMPTY_ANCHOR = 0,
  LINE_TARGET_SUCCESS = 1,
  LINE_TARGET_FAILURE = 2,
  ANCHOR_UNDISCOVERABLE = 3,
  NO_ANCHORS_IN_FILETYPE = 4,
  ANCHOR_MATCH_SUCCESS = 5,
  ANCHOR_MATCH_FAIL = 6,
  BINARY_FILE = 7,
}

export interface VerifyLinkFileError {
  readonly errorType: "file";
  readonly errorCode: FileCheckResponse;
  readonly link: Link;
}

export interface VerifyLinkAnchorError {
  readonly errorType: "anchor";
  readonly errorCode: AnchorCheckResponse;
  readonly link: Link;
}

function hasRequiredNumberOfLines(text: string, requiredNumberOfLines: number): boolean {
  let lineCount = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") {
      lineCount++;
      if (lineCount >= requiredNumberOfLines) {
        return true;
      }
    }
  }

  return false;
}

async function checkFile(basePath: string, destPath: string): Promise<FileCheckResponse> {
  try {
    await fs.access(destPath);
  } catch (accessErr) {
    return FileCheckResponse.FILE_NOT_EXISTS;
  }

  if (destPath.startsWith(basePath + "/") === false) {
    return FileCheckResponse.FILE_OUTSIDE_BASE;
  }

  return FileCheckResponse.SUCCESS;
}

/*
 * If we can't determine the type of the file (because it has no extension), we
 * don't allow anchors for it.
 *
 * If we have a file extension, we don't want to allow line number anchors if
 * it is a renderable document. In this case, we scan the target file for headings.
 *
 * If it's not a renderable document we know about, then and only then do we check
 * for line number anchors. However, it must have a known text file type extension.
 */
async function checkAnchor(
  file: VFile,
  anchor: string,
  { mdType = mdDefaultType }: { mdType: MarkdownType },
): Promise<AnchorCheckResponse> {
  if (!file.extname) {
    return AnchorCheckResponse.ANCHOR_UNDISCOVERABLE;
  }

  if (mdFileExts.has(file.extname)) {
    for (const heading of scanMdFileForHeadings(file, { mdType })) {
      if (heading.anchor === anchor) {
        return AnchorCheckResponse.ANCHOR_MATCH_SUCCESS;
      }
    }

    return AnchorCheckResponse.ANCHOR_MATCH_FAIL;
  }

  if (!isTextPath(file.path)) {
    return AnchorCheckResponse.BINARY_FILE;
  }

  const anchorLinePointerTest = anchor.match(/^L([1-9][0-9]*)=?$/);
  if (anchorLinePointerTest) {
    return hasRequiredNumberOfLines(file.value.toString(), parseInt(anchorLinePointerTest[1]))
      ? AnchorCheckResponse.LINE_TARGET_SUCCESS
      : AnchorCheckResponse.LINE_TARGET_FAILURE;
  }

  return AnchorCheckResponse.NO_ANCHORS_IN_FILETYPE;
}

export async function* verifyLinks(
  basePath: string,
  file: VFile,
  links: IterableIterator<Link>,
  options?: Partial<VerifyLinksOptions>,
): AsyncGenerator<VerifyLinkFileError | VerifyLinkAnchorError> {
  const mergedOptions: VerifyLinksOptions = Object.assign(
    {},
    verifyLinksOptionsDefaults,
    options || {},
  );

  const fileDir = path.join(basePath, file.dirname as string);

  for (const link of links) {
    if (link.url) {
      // We don't support checking URLs yet.
      continue;
    }

    if (link.href.startsWith("#")) {
      const hrefAnchor = link.href.slice(1);
      if (hrefAnchor.length === 0) {
        yield {
          errorType: "anchor",
          errorCode: AnchorCheckResponse.EMPTY_ANCHOR,
          link,
        };
        continue;
      }

      const checkAnchorResult = await checkAnchor(file, hrefAnchor, {
        mdType: mergedOptions.mdType,
      });
      if (
        checkAnchorResult !== AnchorCheckResponse.LINE_TARGET_SUCCESS &&
        checkAnchorResult !== AnchorCheckResponse.ANCHOR_MATCH_SUCCESS
      ) {
        yield {
          errorType: "anchor",
          errorCode: checkAnchorResult,
          link,
        };
      }
      continue;
    }

    const [hrefFile, hrefAnchor] = link.href.split("#", 2);
    const destPath = path.resolve(fileDir, hrefFile);
    const checkFileResult = await checkFile(basePath, destPath);
    if (checkFileResult !== FileCheckResponse.SUCCESS) {
      yield {
        errorType: "file",
        errorCode: checkFileResult,
        link,
      };
      continue;
    }

    if (!hrefAnchor) {
      if (link.href.endsWith("#")) {
        yield {
          errorType: "anchor",
          errorCode: AnchorCheckResponse.EMPTY_ANCHOR,
          link,
        };
      }
      continue;
    }

    const destFile = await read(destPath);
    const checkAnchorResult = await checkAnchor(destFile, hrefAnchor, {
      mdType: mergedOptions.mdType,
    });
    if (
      checkAnchorResult !== AnchorCheckResponse.LINE_TARGET_SUCCESS &&
      checkAnchorResult !== AnchorCheckResponse.ANCHOR_MATCH_SUCCESS
    ) {
      yield {
        errorType: "anchor",
        errorCode: checkAnchorResult,
        link,
      };
    }
  }
}
