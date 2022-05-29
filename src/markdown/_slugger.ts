import GithubSlugger from "github-slugger";

import type { MarkdownType } from "./types";

export interface Slugger {
  slug(value: string): string;
}

const own = Object.hasOwnProperty;

class CustomSlugger {
  private counters: { [key: string]: number } = Object.create(null);

  public slug(value: string): string {
    let slug = value.toLocaleLowerCase().replaceAll(/\s/g, "-").replaceAll(/[^A-Za-z0-9_-]/g, "-").replaceAll(/-{2,}/g, "-").replaceAll(/^-+/g, "").replaceAll(/-+$/g, "");
    const origSlug = slug;

    while (own.call(this.counters, slug)) {
      this.counters[origSlug]++;
      slug = `${origSlug}-${this.counters[origSlug]}`;
    }

    this.counters[slug] = 0;

    return slug;
  }
}

export function prepareSlugger(mdType: MarkdownType): Slugger {
  switch (mdType) {
    case "gfm": return new GithubSlugger();
    default: return new CustomSlugger();
  }
}
