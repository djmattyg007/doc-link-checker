import type { VFile } from "vfile";
import type { Definition as DefinitionNode, Link as LinkNode } from "mdast";

import type { Link } from "../types";
import { convertHrefToUrl } from "../utils.js";
import { prepareProcessor, yieldNodes } from "./_scanner.js";
import { scanOptionsDefaults } from "./_options.js";
import type { ScanMarkdownOptions } from "./types";

export function* scanFileForLinks(
  file: VFile,
  options?: Partial<ScanMarkdownOptions>,
): Generator<Link> {
  const mergedOptions: ScanMarkdownOptions = {
    ...scanOptionsDefaults,
    ...options,
  };

  const processor = prepareProcessor(mergedOptions.mdType);

  const ast = processor.parse(file);

  for (const link of yieldNodes<DefinitionNode | LinkNode>(["definition", "link"], ast)) {
    yield {
      href: link.url,
      url: convertHrefToUrl(link.url),
      position: link.position ?? null,
    };
  }
}
