import { promises as fs } from "node:fs";
import path from "node:path";

import isTextPath from "is-text-path";
import type { VFile } from "vfile";
import { read } from "to-vfile";

import { mdDefaultFileExts, mdDefaultType } from "../filetypes.js";
import type { MarkdownType } from "../markdown/types";
import { scanFileForHeadings as scanMdFileForHeadings } from "../markdown/heading.js";
import type { Link } from "../types";

export interface VerifyLinksOptions {
  readonly mdType: MarkdownType;
  readonly mdFileExts: ReadonlySet<string>;
}

const verifyLinksOptionsDefaults: VerifyLinksOptions = {
  mdType: mdDefaultType,
  mdFileExts: mdDefaultFileExts,
};

export enum FileCheckResponse {
  SUCCESS = 0,
  FILE_NOT_EXISTS = 1,
  FILE_OUTSIDE_BASE = 2,
  CONVERT_PURE_ANCHOR = 3,
}

export enum AnchorCheckResponse {
  EMPTY_ANCHOR = 0,
  BINARY_FILE = 1,
  ANCHOR_UNDISCOVERABLE = 2,
  NO_ANCHORS_IN_FILETYPE = 3,
  HEADING_MATCH_SUCCESS = 4,
  HEADING_MATCH_FAIL = 5,
  LINE_TARGET_SUCCESS = 6,
  LINE_TARGET_FAIL = 7,
  LINE_TARGET_INVALID = 8,
  MULTI_LINE_TARGET_RANGE_INVALID = 9,
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
  for (const element of text) {
    if (element === "\n") {
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
  } catch {
    return FileCheckResponse.FILE_NOT_EXISTS;
  }

  if (!destPath.startsWith(basePath + path.sep)) {
    return FileCheckResponse.FILE_OUTSIDE_BASE;
  }

  return FileCheckResponse.SUCCESS;
}

function checkDocFileAnchor(
  file: VFile,
  anchor: string,
  {
    mdType = mdDefaultType,
    mdFileExts = mdDefaultFileExts,
  }: { mdType: MarkdownType; mdFileExts: ReadonlySet<string> },
): AnchorCheckResponse | null {
  if (!file.extname) {
    return AnchorCheckResponse.ANCHOR_UNDISCOVERABLE;
  }

  if (mdFileExts.has(file.extname)) {
    for (const heading of scanMdFileForHeadings(file, { mdType })) {
      if (heading.anchor === anchor) {
        return AnchorCheckResponse.HEADING_MATCH_SUCCESS;
      }
    }

    return AnchorCheckResponse.HEADING_MATCH_FAIL;
  }

  return null;
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
function checkAnchor(
  file: VFile,
  anchor: string,
  {
    mdType = mdDefaultType,
    mdFileExts = mdDefaultFileExts,
  }: { mdType: MarkdownType; mdFileExts: ReadonlySet<string> },
): AnchorCheckResponse {
  const docFileAnchorCheck = checkDocFileAnchor(file, anchor, { mdType, mdFileExts });
  if (docFileAnchorCheck !== null) {
    return docFileAnchorCheck;
  }

  if (!isTextPath(file.path)) {
    return AnchorCheckResponse.BINARY_FILE;
  }

  const anchorLinePointerTest = /^L([1-9]\d*)=?$/.exec(anchor);
  if (anchorLinePointerTest) {
    return hasRequiredNumberOfLines(
      file.value.toString(),
      Number.parseInt(anchorLinePointerTest[1], 10),
    )
      ? AnchorCheckResponse.LINE_TARGET_SUCCESS
      : AnchorCheckResponse.LINE_TARGET_FAIL;
  }

  const anchorMultiLinePointerTest = /^L([1-9]\d*)-L([1-9]\d*)=?$/.exec(anchor);
  if (anchorMultiLinePointerTest) {
    const start = Number.parseInt(anchorMultiLinePointerTest[1], 10);
    const end = Number.parseInt(anchorMultiLinePointerTest[2], 10);
    if (start >= end) {
      return AnchorCheckResponse.MULTI_LINE_TARGET_RANGE_INVALID;
    }
    return hasRequiredNumberOfLines(file.value.toString(), end)
      ? AnchorCheckResponse.LINE_TARGET_SUCCESS
      : AnchorCheckResponse.LINE_TARGET_FAIL;
  }

  if (/^L[^1-9]/.test(anchor)) {
    return AnchorCheckResponse.LINE_TARGET_INVALID;
  }

  return AnchorCheckResponse.NO_ANCHORS_IN_FILETYPE;
}

function verifyPureAnchorLink(
  file: VFile,
  link: Link,
  options: VerifyLinksOptions,
): VerifyLinkAnchorError | undefined {
  const hrefAnchor = link.href.slice(1);
  if (hrefAnchor.length === 0) {
    return {
      errorType: "anchor",
      errorCode: AnchorCheckResponse.EMPTY_ANCHOR,
      link,
    };
  }

  const checkAnchorResult = checkDocFileAnchor(file, hrefAnchor, {
    mdType: options.mdType,
    mdFileExts: options.mdFileExts,
  });
  if (checkAnchorResult === null) {
    return {
      errorType: "anchor",
      errorCode: AnchorCheckResponse.NO_ANCHORS_IN_FILETYPE,
      link,
    };
  }

  if (
    checkAnchorResult !== AnchorCheckResponse.LINE_TARGET_SUCCESS &&
    checkAnchorResult !== AnchorCheckResponse.HEADING_MATCH_SUCCESS
  ) {
    return {
      errorType: "anchor",
      errorCode: checkAnchorResult,
      link,
    };
  }

  return undefined;
}

async function verifyNonPureAnchorLink(
  basePath: string,
  file: VFile,
  link: Link,
  options: VerifyLinksOptions,
): Promise<VerifyLinkFileError | VerifyLinkAnchorError | undefined> {
  const fileDir = path.join(basePath, file.dirname!);

  const [hrefFile, hrefAnchor] = link.href.split("#", 2);
  const linkDestPath = path.resolve(fileDir, hrefFile);

  if (linkDestPath === path.resolve(basePath, file.path)) {
    return {
      errorType: "file",
      errorCode: FileCheckResponse.CONVERT_PURE_ANCHOR,
      link,
    };
  }

  const checkFileResult = await checkFile(basePath, linkDestPath);
  if (checkFileResult !== FileCheckResponse.SUCCESS) {
    return {
      errorType: "file",
      errorCode: checkFileResult,
      link,
    };
  }

  if (!hrefAnchor) {
    if (link.href.endsWith("#")) {
      return {
        errorType: "anchor",
        errorCode: AnchorCheckResponse.EMPTY_ANCHOR,
        link,
      };
    }
    return;
  }

  const destFile = await read(linkDestPath);
  const checkAnchorResult = checkAnchor(destFile, hrefAnchor, {
    mdType: options.mdType,
    mdFileExts: options.mdFileExts,
  });
  if (
    checkAnchorResult !== AnchorCheckResponse.LINE_TARGET_SUCCESS &&
    checkAnchorResult !== AnchorCheckResponse.HEADING_MATCH_SUCCESS
  ) {
    return {
      errorType: "anchor",
      errorCode: checkAnchorResult,
      link,
    };
  }

  return undefined;
}

export async function* verifyLinks(
  basePath: string,
  file: VFile,
  links: Iterable<Link>,
  options?: Partial<VerifyLinksOptions>,
): AsyncGenerator<VerifyLinkFileError | VerifyLinkAnchorError> {
  const mergedOptions: VerifyLinksOptions = {
    ...verifyLinksOptionsDefaults,
    ...options,
  };

  // Normalise the input so it's absolute, and contains no trailing path separators.
  basePath = path.resolve(basePath);

  for (const link of links) {
    if (link.url) {
      // We don't support checking URLs yet.
      continue;
    }

    if (link.href.startsWith("#")) {
      const verifyPureAnchorResponse = verifyPureAnchorLink(file, link, mergedOptions);
      if (verifyPureAnchorResponse) {
        yield verifyPureAnchorResponse;
      }
    } else {
      // There is necessary logic that must occur before running this logic.
      // Also we're in an async generator, so it doesn't make sense to evaluate
      // all the possible promises at once anyway.
      // eslint-disable-next-line no-await-in-loop
      const verifyNonPureAnchorResponse = await verifyNonPureAnchorLink(
        basePath,
        file,
        link,
        mergedOptions,
      );
      if (verifyNonPureAnchorResponse) {
        yield verifyNonPureAnchorResponse;
      }
    }
  }
}
