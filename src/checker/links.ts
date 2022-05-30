import { promises as fs } from "node:fs";
import path from "node:path";

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
  LINE_TARGET_FAIL = 2,
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

  if (!destPath.startsWith(basePath + "/")) {
    return FileCheckResponse.FILE_OUTSIDE_BASE;
  }

  return FileCheckResponse.SUCCESS;
}

function checkDocFileAnchor(
  file: VFile,
  anchor: string,
  { mdType = mdDefaultType }: { mdType: MarkdownType },
): AnchorCheckResponse | null {
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
  { mdType = mdDefaultType }: { mdType: MarkdownType },
): AnchorCheckResponse {
  const docFileAnchorCheck = checkDocFileAnchor(file, anchor, { mdType });
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
    checkAnchorResult !== AnchorCheckResponse.ANCHOR_MATCH_SUCCESS
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
  const destPath = path.resolve(fileDir, hrefFile);
  const checkFileResult = await checkFile(basePath, destPath);
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

  const destFile = await read(destPath);
  const checkAnchorResult = checkAnchor(destFile, hrefAnchor, {
    mdType: options.mdType,
  });
  if (
    checkAnchorResult !== AnchorCheckResponse.LINE_TARGET_SUCCESS &&
    checkAnchorResult !== AnchorCheckResponse.ANCHOR_MATCH_SUCCESS
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
