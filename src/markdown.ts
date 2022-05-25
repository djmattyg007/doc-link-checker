import type { Node, Parent } from "unist";
import { unified, Processor } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { Link, Heading, Literal } from "mdast";
import type { VFile } from "vfile";

import { mdDefaultType } from "./filetypes.js";
import type { LinkReference, HeadingReference } from "./types";
import { convertHrefToUrl } from "./util.js";

export type MarkdownType = "commonmark" | "gfm";

export interface ScanMarkdownOptions {
  readonly mdType: MarkdownType;
}

const scanOptionsDefaults: ScanMarkdownOptions = {
  mdType: mdDefaultType,
};

function* yieldNodes<N extends Node>(type: string, node: Node | Parent): Generator<N> {
  if (node.type === type) {
    yield node as N;
  } else if ("children" in node && node.children) {
    for (const child of node.children) {
      yield* yieldNodes(type, child);
    }
  }
}

function prepareProcessor(mdType: MarkdownType): Processor {
  let processor: Processor = unified().use(remarkParse);
  if (mdType === "gfm") {
    processor = processor.use(remarkGfm);
  }
  return processor;
}

export async function* scanFileForLinks(file: VFile, options?: Partial<ScanMarkdownOptions>): AsyncGenerator<LinkReference> {
  const mergedOptions: ScanMarkdownOptions = Object.assign({}, scanOptionsDefaults, options || {});

  const processor = prepareProcessor(mergedOptions.mdType);

  const ast = processor.parse(file);

  for (const link of yieldNodes<Link>("link", ast)) {
    yield {
      href: link.url,
      url: convertHrefToUrl(link.url),
      position: link.position || null,
    };
  }
}

export async function* scanFileForHeadings(file: VFile, options?: Partial<ScanMarkdownOptions>): AsyncGenerator<HeadingReference> {
  const mergedOptions: ScanMarkdownOptions = Object.assign({}, scanOptionsDefaults, options || {});

  const processor = prepareProcessor(mergedOptions.mdType);

  const ast = processor.parse(file);

  for (const heading of yieldNodes<Heading>("heading", ast)) {
    let headingText = "";
    for (const headingTextNode of (heading.children as Literal[])) {
      headingText += headingTextNode.value;
    }

    yield {
      depth: heading.depth,
      text: headingText,
      anchor: headingText.replaceAll(/\s/g, "-").replaceAll(/[^A-Za-z0-9_-]/g, ""),
      position: heading.position || null,
    };
  }
}
