import type { Node, Parent } from "unist";
import { unified, Processor } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";

import type { MarkdownType } from "./types";

export function* yieldNodes<N extends Node>(type: string, node: Node | Parent): Generator<N> {
  if (node.type === type) {
    yield node as N;
  } else if ("children" in node && node.children) {
    for (const child of node.children) {
      yield* yieldNodes(type, child);
    }
  }
}

export function prepareProcessor(mdType: MarkdownType): Processor {
  let processor: Processor = unified().use(remarkParse);
  if (mdType === "gfm") {
    processor = processor.use(remarkGfm);
  }
  return processor;
}
