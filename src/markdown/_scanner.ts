import type { Node, Parent } from "unist";
import { unified, Processor } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";

import type { MarkdownType } from "./types";

function* yieldSingleTypeNodes<N extends Node>(type: string, node: Node | Parent): Generator<N> {
  if (node.type === type) {
    yield node as N;
  } else if ("children" in node && node.children) {
    for (const child of node.children) {
      yield* yieldSingleTypeNodes(type, child);
    }
  }
}

function* yieldMultiTypeNodes<N extends Node>(
  types: ReadonlyArray<string>,
  node: Node | Parent,
): Generator<N> {
  if (types.includes(node.type)) {
    yield node as N;
  } else if ("children" in node && node.children) {
    for (const child of node.children) {
      yield* yieldMultiTypeNodes(types, child);
    }
  }
}

export function* yieldNodes<N extends Node>(
  type: string | ReadonlyArray<string>,
  ast: Node | Parent,
): Generator<N> {
  if (typeof type === "string") {
    yield* yieldSingleTypeNodes(type, ast);
  } else {
    yield* yieldMultiTypeNodes(type, ast);
  }
}

export function prepareProcessor(mdType: MarkdownType): Processor {
  let processor: Processor = unified().use(remarkParse);
  if (mdType === "gfm") {
    processor = processor.use(remarkGfm);
  }
  return processor;
}
