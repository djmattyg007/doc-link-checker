import { describe, it } from "mocha";
import { assert } from "chai";

import { VFile } from "vfile";

import { enumerateSync, heredoc, unwindSync } from "../util.js";

import { scanFileForLinks } from "../../src/markdown/link.js";

describe("markdown link scanner", function () {
  it("detects no links in an empty file", function () {
    const file = new VFile("");
    const scan = scanFileForLinks(file);
    const results = unwindSync(scan);
    assert.lengthOf(results, 0);
  });

  it("detects no links in a non-empty file", function () {
    const file = new VFile(
      heredoc(`
      # this is a heading

      ## this is a sub-heading

      this is **some** text
      `),
    );
    const scan = scanFileForLinks(file);
    const results = unwindSync(scan);
    assert.lengthOf(results, 0);
  });

  it("detects HTTP links", function () {
    const file = new VFile(
      heredoc(`
      # a heading
      [github](https://example.com)
      `),
    );
    const scan = scanFileForLinks(file);
    const results = unwindSync(scan);
    assert.lengthOf(results, 1);

    const link = results[0];
    assert.strictEqual(link.href, "https://example.com");
    assert.instanceOf(link.url, URL);
    assert.strictEqual(link.position?.start.line, 2);
  });

  it("detects HTTP links with anchors", function () {
    const file = new VFile(
      heredoc(`
      # a heading
      [github](https://example.com/page1#anchor)
      `),
    );
    const scan = scanFileForLinks(file);
    const results = unwindSync(scan);
    assert.lengthOf(results, 1);

    const link = results[0];
    assert.strictEqual(link.href, "https://example.com/page1#anchor");
    assert.instanceOf(link.url, URL);
    assert.strictEqual(link.position?.start.line, 2);
  });

  it("detects data URIs", function () {
    const file = new VFile(
      heredoc(`
      # another heading

      [picture](data:image/png,base64;abcdef0123456789)
      `),
    );
    const scan = scanFileForLinks(file);
    const results = unwindSync(scan);
    assert.lengthOf(results, 1);

    const link = results[0];
    assert.strictEqual(link.href, "data:image/png,base64;abcdef0123456789");
    assert.instanceOf(link.url, URL);
    assert.strictEqual(link.position?.start.line, 3);
  });

  const genDetectRelativeHref = (href: string) =>
    function () {
      const file = new VFile(
        heredoc(`
        # a new file

        Some text goes here. [This is](${href})
        `),
      );
      const scan = scanFileForLinks(file);
      const results = unwindSync(scan);
      assert.lengthOf(results, 1);

      const link = results[0];
      assert.strictEqual(link.href, href);
      assert.isNull(link.url);
      assert.strictEqual(link.position?.start.line, 3);
    };
  const relativeHrefCases = [
    "README.md",
    "./docs/getting-started.md",
    "assets/flowchart.png",
    "../CONTRIBUTING.md",
  ];
  // Acceptable stateless setup inside describe()
  // eslint-disable-next-line mocha/no-setup-in-describe
  for (const [count, href] of enumerateSync(relativeHrefCases, { start: 1 })) {
    it(`detects relative hrefs ${count}`, genDetectRelativeHref(href));
  }

  const genDetectRelativeHrefWithAnchor = (href: string) =>
    function () {
      const file = new VFile(
        heredoc(`
        # a heading

        More text goes here. [Go here](${href})
        `),
      );
      const scan = scanFileForLinks(file);
      const results = unwindSync(scan);
      assert.lengthOf(results, 1);

      const link = results[0];
      assert.strictEqual(link.href, href);
      assert.isNull(link.url);
      assert.strictEqual(link.position?.start.line, 3);
    };
  const relativeHrefWithAnchorCases = [
    "README.md#section-one",
    "./docs/getting-started.md#dont-start",
    "assets/notes.txt#L22",
    "../CONTRIBUTING.md#linting",
  ];
  // Acceptable stateless setup inside describe()
  // eslint-disable-next-line mocha/no-setup-in-describe
  for (const [count, href] of enumerateSync(relativeHrefWithAnchorCases, { start: 1 })) {
    it(`detects relative hrefs with anchors ${count}`, genDetectRelativeHrefWithAnchor(href));
  }

  it("detects multiple links on a single line", function () {
    const file = new VFile(
      heredoc(`
      There are [two](https://example.com) links on [this](../../README.md) line.
      `),
    );
    const scan = scanFileForLinks(file);
    const results = unwindSync(scan);
    assert.lengthOf(results, 2);

    const link1 = results[0];
    assert.strictEqual(link1.href, "https://example.com");
    assert.instanceOf(link1.url, URL);
    assert.strictEqual(link1.position?.start.line, 1);

    const link2 = results[1];
    assert.strictEqual(link2.href, "../../README.md");
    assert.isNull(link2.url);
    assert.strictEqual(link2.position?.start.line, 1);
  });

  it("detects links in definitions", function () {
    const file = new VFile(
      heredoc(`
      # This is a heading
      [cool-stuff]: https://example.com
      [secret-stuff]: ./test.md#anchor
      `),
    );
    const scan = scanFileForLinks(file);
    const results = unwindSync(scan);
    assert.lengthOf(results, 2);

    const link1 = results[0];
    assert.strictEqual(link1.href, "https://example.com");
    assert.instanceOf(link1.url, URL);
    assert.strictEqual(link1.position?.start.line, 2);

    const link2 = results[1];
    assert.strictEqual(link2.href, "./test.md#anchor");
    assert.isNull(link2.url);
    assert.strictEqual(link2.position?.start.line, 3);
  });
});
