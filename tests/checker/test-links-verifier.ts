import { describe, it } from "mocha";
import { assert } from "chai";

import { VFile } from "vfile";

import { enumerate, getFixtureDir, heredoc, unwind } from "../util.js";

import { AnchorCheckResponse, FileCheckResponse, verifyLinks } from "../../src/checker/links.js";
import type { Link } from "../../src/types";

const fixtureDir = getFixtureDir("fixture1");

function makeLink(href: string): Link {
  return {
    href,
    url: null,
    position: null,
  };
}

describe("links verifier", function () {
  it("returns no errors when there are no links", async function () {
    const file = new VFile({
      value: "",
      cwd: fixtureDir,
      path: "other-docs/doc.md",
    });
    const verify = verifyLinks(fixtureDir, file, []);
    const results = await unwind(verify);
    assert.lengthOf(results, 0);
  });

  it("performs no checks for URLs", async function () {
    const file = new VFile({
      value: "",
      cwd: fixtureDir,
      path: "other-docs/doc.md",
    });
    const urlLink = {
      href: "https://example.com",
      url: new URL("https://example.com"),
      position: null,
    };
    const verify = verifyLinks(fixtureDir, file, [urlLink]);
    const results = await unwind(verify);
    assert.lengthOf(results, 0);
  });

  it("returns no errors for valid links", async function () {
    const file = new VFile({
      value: "",
      cwd: fixtureDir,
      path: "other-docs/doc.md",
    });
    const links: Link[] = [
      makeLink("../README.md"),
      makeLink("../fake"),
      makeLink("../docs/doc1.md"),
      makeLink("../docs/image.png"),
      makeLink("../notes/stuff.txt"),
    ];
    const verify = verifyLinks(fixtureDir, file, links);
    const results = await unwind(verify);
    assert.lengthOf(results, 0);
  });

  it("returns no errors for valid links with anchors", async function () {
    const file = new VFile({
      value: "# heading\n",
      cwd: fixtureDir,
      path: "other-docs/doc.md",
    });
    const links: Link[] = [
      makeLink("../README.md#cool-stuff"),
      makeLink("../docs/doc1.md#first-section"),
      makeLink("#heading"),
      makeLink("../notes/stuff.txt#L2"),
      makeLink("../notes/stuff.txt#L4="),
      makeLink("../notes/stuff.txt#L1-L2"),
      makeLink("../notes/stuff.txt#L2-L5="),
    ];
    const verify = verifyLinks(fixtureDir, file, links);
    const results = await unwind(verify);
    assert.lengthOf(results, 0);
  });

  it("returns errors when links target non-existent files", async function () {
    const file = new VFile({
      value: "",
      cwd: fixtureDir,
      path: "other-docs/doc.md",
    });
    const links: Link[] = [
      makeLink("test.md"),
      makeLink("./fail/ure"),
      makeLink("../real.md"),
      makeLink("../docs/doc3.md"),
    ];
    const verify = verifyLinks(fixtureDir, file, links);
    let counter = 0;
    for await (const [idx, verifyError] of enumerate(verify)) {
      counter++;
      assert.strictEqual(verifyError.errorType, "file");
      assert.strictEqual(verifyError.errorCode, FileCheckResponse.FILE_NOT_EXISTS);
      assert.deepStrictEqual(verifyError.link, links[idx]);
    }
    assert.strictEqual(counter, 4);
  });

  it("returns errors when links target files outside the base", async function () {
    const file = new VFile({
      value: "",
      cwd: fixtureDir,
      path: "other-docs/doc.md",
    });
    const links: Link[] = [makeLink("../../sentinel")];
    const verify = verifyLinks(fixtureDir, file, links);
    let counter = 0;
    for await (const [idx, verifyError] of enumerate(verify)) {
      counter++;
      assert.strictEqual(verifyError.errorType, "file");
      assert.strictEqual(verifyError.errorCode, FileCheckResponse.FILE_OUTSIDE_BASE);
      assert.deepStrictEqual(verifyError.link, links[idx]);
    }
    assert.strictEqual(counter, 1);
  });

  it("returns errors when pure-anchor links target non-existent anchors", async function () {
    const file = new VFile({
      value: heredoc(`
      # a heading
      a [broken](#heading) link
      `),
      cwd: fixtureDir,
      path: "other-docs/doc.md",
    });
    const links: Link[] = [makeLink("#heading")];
    const verify = verifyLinks(fixtureDir, file, links);
    let counter = 0;
    for await (const [idx, verifyError] of enumerate(verify)) {
      counter++;
      assert.strictEqual(verifyError.errorType, "anchor");
      assert.strictEqual(verifyError.errorCode, AnchorCheckResponse.ANCHOR_MATCH_FAIL);
      assert.deepStrictEqual(verifyError.link, links[idx]);
    }
    assert.strictEqual(counter, 1);
  });

  it("returns errors when pure-anchor links are in files with no file extension", async function () {
    const file = new VFile({
      value: heredoc(`
      # a heading
      a [link](#a-heading)
      `),
      cwd: fixtureDir,
      path: "other-docs/doc",
    });
    const links: Link[] = [makeLink("#a-heading")];
    const verify = verifyLinks(fixtureDir, file, links);
    let counter = 0;
    for await (const [idx, verifyError] of enumerate(verify)) {
      counter++;
      assert.strictEqual(verifyError.errorType, "anchor");
      assert.strictEqual(verifyError.errorCode, AnchorCheckResponse.ANCHOR_UNDISCOVERABLE);
      assert.deepStrictEqual(verifyError.link, links[idx]);
    }
    assert.strictEqual(counter, 1);
  });

  it("returns errors when pure-anchor links are in files with an unrecognised file extension", async function () {
    const file = new VFile({
      value: heredoc(`
      # a heading
      a [link](#a-heading)
      `),
      cwd: fixtureDir,
      path: "other-docs/doc.test",
    });
    const links: Link[] = [makeLink("#a-heading")];
    const verify = verifyLinks(fixtureDir, file, links);
    let counter = 0;
    for await (const [idx, verifyError] of enumerate(verify)) {
      counter++;
      assert.strictEqual(verifyError.errorType, "anchor");
      assert.strictEqual(verifyError.errorCode, AnchorCheckResponse.NO_ANCHORS_IN_FILETYPE);
      assert.deepStrictEqual(verifyError.link, links[idx]);
    }
    assert.strictEqual(counter, 1);
  });

  it("returns errors when links have empty anchors", async function () {
    const file = new VFile({
      value: heredoc(`
      # a heading
      a [link](#)
      another [link](../README.md#)
      `),
      cwd: fixtureDir,
      path: "other-docs/document",
    });
    const links: Link[] = [makeLink("#"), makeLink("../README.md#")];
    const verify = verifyLinks(fixtureDir, file, links);
    let counter = 0;
    for await (const [idx, verifyError] of enumerate(verify)) {
      counter++;
      assert.strictEqual(verifyError.errorType, "anchor");
      assert.strictEqual(verifyError.errorCode, AnchorCheckResponse.EMPTY_ANCHOR);
      assert.deepStrictEqual(verifyError.link, links[idx]);
    }
    assert.strictEqual(counter, 2);
  });

  it("returns errors when links targeting binary files have anchors", async function () {
    const file = new VFile({
      value: "",
      cwd: fixtureDir,
      path: "other-docs/doc.md",
    });
    const links: Link[] = [
      makeLink("../docs/image.png#heading"),
      makeLink("../docs/image.png#L42"),
    ];
    const verify = verifyLinks(fixtureDir, file, links);
    let counter = 0;
    for await (const [idx, verifyError] of enumerate(verify)) {
      counter++;
      assert.strictEqual(verifyError.errorType, "anchor");
      assert.strictEqual(verifyError.errorCode, AnchorCheckResponse.BINARY_FILE);
      assert.deepStrictEqual(verifyError.link, links[idx]);
    }
    assert.strictEqual(counter, 2);
  });

  it("returns errors when links targeting files with no extension have anchors", async function () {
    const file = new VFile({
      value: "",
      cwd: fixtureDir,
      path: "other-docs/doc.md",
    });
    const links: Link[] = [makeLink("../fake#nope"), makeLink("../fake#L10")];
    const verify = verifyLinks(fixtureDir, file, links);
    let counter = 0;
    for await (const [idx, verifyError] of enumerate(verify)) {
      counter++;
      assert.strictEqual(verifyError.errorType, "anchor");
      assert.strictEqual(verifyError.errorCode, AnchorCheckResponse.ANCHOR_UNDISCOVERABLE);
      assert.deepStrictEqual(verifyError.link, links[idx]);
    }
    assert.strictEqual(counter, 2);
  });

  it("returns errors when links targeting files have a non-existent anchor", async function () {
    const file = new VFile({
      value: "",
      cwd: fixtureDir,
      path: "other-docs/doc.md",
    });
    const links: Link[] = [makeLink("../README.md#nope"), makeLink("../docs/doc1.md#maybe")];
    const verify = verifyLinks(fixtureDir, file, links);
    let counter = 0;
    for await (const [idx, verifyError] of enumerate(verify)) {
      counter++;
      assert.strictEqual(verifyError.errorType, "anchor");
      assert.strictEqual(verifyError.errorCode, AnchorCheckResponse.ANCHOR_MATCH_FAIL);
      assert.deepStrictEqual(verifyError.link, links[idx]);
    }
    assert.strictEqual(counter, 2);
  });

  it("returns errors when links targeting documentation files have line number anchors", async function () {
    const file = new VFile({
      value: "# a heading\n",
      cwd: fixtureDir,
      path: "other-docs/doc.md",
    });
    const links: Link[] = [
      makeLink("../README.md#L3"),
      makeLink("../docs/doc1.md#L20"),
      makeLink("#L45"),
    ];
    const verify = verifyLinks(fixtureDir, file, links);
    let counter = 0;
    for await (const [idx, verifyError] of enumerate(verify)) {
      counter++;
      assert.strictEqual(verifyError.errorType, "anchor");
      assert.strictEqual(verifyError.errorCode, AnchorCheckResponse.ANCHOR_MATCH_FAIL);
      assert.deepStrictEqual(verifyError.link, links[idx]);
    }
    assert.strictEqual(counter, 3);
  });

  it("returns errors when links with anchors targeting line numbers are out of range", async function () {
    const file = new VFile({
      value: "",
      cwd: fixtureDir,
      path: "other-docs/doc.md",
    });
    const links: Link[] = [makeLink("../notes/stuff.txt#L100")];
    const verify = verifyLinks(fixtureDir, file, links);
    let counter = 0;
    for await (const [idx, verifyError] of enumerate(verify)) {
      counter++;
      assert.strictEqual(verifyError.errorType, "anchor");
      assert.strictEqual(verifyError.errorCode, AnchorCheckResponse.LINE_TARGET_FAIL);
      assert.deepStrictEqual(verifyError.link, links[idx]);
    }
    assert.strictEqual(counter, 1);
  });

  it("returns errors when links with anchors targeting line numbers are invalid", async function () {
    const file = new VFile({
      value: "",
      cwd: fixtureDir,
      path: "other-docs/doc.md",
    });
    const links: Link[] = [makeLink("../notes/stuff.txt#L01"), makeLink("../notes/stuff.txt#LXYZ")];
    const verify = verifyLinks(fixtureDir, file, links);
    let counter = 0;
    for await (const [idx, verifyError] of enumerate(verify)) {
      counter++;
      assert.strictEqual(verifyError.errorType, "anchor");
      assert.strictEqual(verifyError.errorCode, AnchorCheckResponse.LINE_TARGET_INVALID);
      assert.deepStrictEqual(verifyError.link, links[idx]);
    }
    assert.strictEqual(counter, 2);
  });

  it("returns errors when links with anchors targeting line number ranges have an invalid range", async function () {
    const file = new VFile({
      value: "",
      cwd: fixtureDir,
      path: "other-docs/doc.md",
    });
    const links: Link[] = [makeLink("../notes/stuff.txt#L2-L1")];
    const verify = verifyLinks(fixtureDir, file, links);
    let counter = 0;
    for await (const [idx, verifyError] of enumerate(verify)) {
      counter++;
      assert.strictEqual(verifyError.errorType, "anchor");
      assert.strictEqual(verifyError.errorCode, AnchorCheckResponse.MULTI_LINE_TARGET_RANGE_INVALID);
      assert.deepStrictEqual(verifyError.link, links[idx]);
    }
    assert.strictEqual(counter, 1);
  });
});
