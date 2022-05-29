import { describe, it } from "mocha";
import { assert } from "chai";

import { VFile } from "vfile";

import { heredoc, unwindSync } from "../util.js";

import { scanFileForHeadings } from "../../src/markdown/heading.js";
import type { HeadingReference } from "../../src/types";

function verifyHeading(
  heading: HeadingReference,
  text: string,
  anchor: string,
  depth: number,
  startLine: number,
): void {
  assert.strictEqual(heading.text, text);
  assert.strictEqual(heading.anchor, anchor);
  assert.strictEqual(heading.depth, depth);
  assert.strictEqual(heading.position?.start.line, startLine);
}

describe("markdown heading scanner", function () {
  it("detects no headings in an empty file", function () {
    const file = new VFile("");
    const scan = scanFileForHeadings(file);
    const results = unwindSync(scan);
    assert.lengthOf(results, 0);
  });

  it("detects no headings in a non-empty file", function () {
    const file = new VFile(
      heredoc(`
      This is **some text**.

      This line contains a [link](./link.png).
      `),
    );
    const scan = scanFileForHeadings(file);
    const results = unwindSync(scan);
    assert.lengthOf(results, 0);
  });

  it("detects headings 1", function () {
    const file = new VFile(
      heredoc(`
      # This is a heading

      ## This is another heading

      ### Headings can contain \`code blocks\`

      ##This is not a heading

      #### This is a question?

      # emoji 😃 heading
      `),
    );
    const scan = scanFileForHeadings(file);
    const results = unwindSync(scan);
    assert.lengthOf(results, 5);

    verifyHeading(results[0], "This is a heading", "this-is-a-heading", 1, 1);
    verifyHeading(results[1], "This is another heading", "this-is-another-heading", 2, 3);
    verifyHeading(
      results[2],
      "Headings can contain code blocks",
      "headings-can-contain-code-blocks",
      3,
      5,
    );
    verifyHeading(results[3], "This is a question?", "this-is-a-question", 4, 9);
    verifyHeading(results[4], "emoji 😃 heading", "emoji-heading", 1, 11);
  });

  it("detects headings 2", function () {
    const file = new VFile(
      heredoc(`
      # this is a heading

      ##   this is another heading

      ### This heading has \`code blocks\` in it

      ## marks ? !

      ## more ? marks ?! more $^% keep going @

      ###notaheading

      ### what about 😃  emoji

      ### marks ? !
      `),
    );
    const scan = scanFileForHeadings(file);
    const results = unwindSync(scan);
    assert.lengthOf(results, 7);

    verifyHeading(results[0], "this is a heading", "this-is-a-heading", 1, 1);
    verifyHeading(results[1], "this is another heading", "this-is-another-heading", 2, 3);
    verifyHeading(
      results[2],
      "This heading has code blocks in it",
      "this-heading-has-code-blocks-in-it",
      3,
      5,
    );
    verifyHeading(results[3], "marks ? !", "marks", 2, 7);
    verifyHeading(
      results[4],
      "more ? marks ?! more $^% keep going @",
      "more-marks-more-keep-going",
      2,
      9,
    );
    verifyHeading(results[5], "what about 😃  emoji", "what-about-emoji", 3, 13);
    verifyHeading(results[6], "marks ? !", "marks-1", 3, 15);
  });

  it("detects gfm headings", function () {
    const file = new VFile(
      heredoc(`
      # this is a heading

      ##   this is another heading

      ### This heading has \`code blocks\` in it

      ## marks ? !

      ## more ? marks ?! more $^% keep going @

      ###notaheading

      ### what about 😃  emoji

      ### marks ? !
      `),
    );
    const scan = scanFileForHeadings(file, { mdType: "gfm" });
    const results = unwindSync(scan);
    assert.lengthOf(results, 7);

    verifyHeading(results[0], "this is a heading", "this-is-a-heading", 1, 1);
    verifyHeading(results[1], "this is another heading", "this-is-another-heading", 2, 3);
    verifyHeading(
      results[2],
      "This heading has code blocks in it",
      "this-heading-has-code-blocks-in-it",
      3,
      5,
    );
    verifyHeading(results[3], "marks ? !", "marks--", 2, 7);
    verifyHeading(
      results[4],
      "more ? marks ?! more $^% keep going @",
      "more--marks--more--keep-going-",
      2,
      9,
    );
    verifyHeading(results[5], "what about 😃  emoji", "what-about---emoji", 3, 13);
    verifyHeading(results[6], "marks ? !", "marks---1", 3, 15);
  });

  it("handles slugging many repeat headings", function () {
    const file = new VFile(
      heredoc(`
      # heading
      # heading
      # heading
      # heading
      # heading
      # heading
      # heading
      # heading
      # heading
      # heading
      # heading
      # heading
      `),
    );
    const scan = scanFileForHeadings(file);

    const firstResult = scan.next();
    assert.strictEqual(firstResult.value.anchor, "heading");

    let counter = 1;
    for (const result of scan) {
      assert.strictEqual(result.anchor, `heading-${counter}`);
      counter++;
    }

    assert.strictEqual(counter, 12);
  });

  it("handles gfm-slugging many repeat headings", function () {
    const file = new VFile(
      heredoc(`
      # heading
      # heading
      # heading
      # heading
      # heading
      # heading
      # heading
      # heading
      # heading
      # heading
      # heading
      # heading
      `),
    );
    const scan = scanFileForHeadings(file, { mdType: "gfm" });

    const firstResult = scan.next();
    assert.strictEqual(firstResult.value.anchor, "heading");

    let counter = 1;
    for (const result of scan) {
      assert.strictEqual(result.anchor, `heading-${counter}`);
      counter++;
    }

    assert.strictEqual(counter, 12);
  });
});
