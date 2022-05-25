import type { Node, Parent } from "unist";
import { unified, Processor } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { Link } from "mdast";
import type { VFile } from "vfile";

import type { LinkReference } from "./types";
import { determineHrefType } from "./util.js";

export type MarkdownType = "commonmark" | "gfm";

export interface ScanMarkdownOptions {
  readonly mdType: MarkdownType;
}

const scanOptionsDefaults: ScanMarkdownOptions = {
  mdType: "commonmark",
};

function* yieldLinkNodes(node: Node | Parent | Link): Generator<Link> {
  if (node.type === "link") {
    yield node as Link;
  } else if ("children" in node && node.children) {
    for (const child of node.children) {
      yield* yieldLinkNodes(child);
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

export async function* scanMarkdownFile(file: VFile, options?: Partial<ScanMarkdownOptions>): AsyncGenerator<LinkReference> {
  const mergedOptions: ScanMarkdownOptions = Object.assign({}, scanOptionsDefaults, options || {});

  const processor = prepareProcessor(mergedOptions.mdType);

  const ast = processor.parse(file);

  for (const link of yieldLinkNodes(ast)) {
    yield {
      href: link.url,
      url: determineHrefType(link.url),
      position: link.position || null,
    };
  }
}
