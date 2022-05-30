import type { VFile } from "vfile";
import type { Heading as HeadingNode, Literal as LiteralNode } from "mdast";

import { prepareProcessor, yieldNodes } from "./_scanner.js";
import { scanOptionsDefaults } from "./_options.js";
import type { ScanMarkdownOptions } from "./types";
import { prepareSlugger } from "./_slugger.js";
import type { Heading } from "../types";

export function* scanFileForHeadings(
  file: VFile,
  options?: Partial<ScanMarkdownOptions>,
): Generator<Heading> {
  const mergedOptions: ScanMarkdownOptions = Object.assign({}, scanOptionsDefaults, options || {});

  const processor = prepareProcessor(mergedOptions.mdType);

  const ast = processor.parse(file);

  const slugger = prepareSlugger(mergedOptions.mdType);

  for (const heading of yieldNodes<HeadingNode>("heading", ast)) {
    const headingText = (heading.children as LiteralNode[]).reduce(
      (allText, textNode) => allText + textNode.value,
      "",
    );

    yield {
      depth: heading.depth,
      text: headingText,
      anchor: slugger.slug(headingText),
      position: heading.position || null,
    };
  }
}
