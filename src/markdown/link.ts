import type { VFile } from "vfile";
import type { Link } from "mdast";

import { prepareProcessor } from "./_scanner.js";
import { scanOptionsDefaults } from "./_options.js";
import type { ScanMarkdownOptions } from "./types";
import { yieldNodes } from "./_scanner.js";
import type { LinkReference } from "../types";
import { convertHrefToUrl } from "../utils.js";

export function* scanFileForLinks(file: VFile, options?: Partial<ScanMarkdownOptions>): Generator<LinkReference> {
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
