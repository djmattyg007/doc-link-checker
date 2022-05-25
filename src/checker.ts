import type { VFile } from "vfile";

import type { LinkReference } from "./types";

export async function verifyLinks(file: VFile, linkRefs: AsyncIterableIterator<LinkReference>) {
  for await (const link of linkRefs) {
    console.log(link.href);
  }
}
