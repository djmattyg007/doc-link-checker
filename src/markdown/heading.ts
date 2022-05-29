import type { VFile } from "vfile";
import type { Heading, Literal } from "mdast";

import { prepareProcessor } from "./_scanner.js";
import { scanOptionsDefaults } from "./_options.js";
import type { ScanMarkdownOptions } from "./types";
import { yieldNodes } from "./_scanner.js";
import { prepareSlugger } from "./_slugger.js";
import type { HeadingReference } from "../types";

export function* scanFileForHeadings(
  file: VFile,
  options?: Partial<ScanMarkdownOptions>,
): Generator<HeadingReference> {
  const mergedOptions: ScanMarkdownOptions = Object.assign({}, scanOptionsDefaults, options || {});

  const processor = prepareProcessor(mergedOptions.mdType);

  const ast = processor.parse(file);

  const slugger = prepareSlugger(mergedOptions.mdType);

  for (const heading of yieldNodes<Heading>("heading", ast)) {
    const headingText = (heading.children as Literal[]).reduce(
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
