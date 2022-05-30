import { describe, it } from "mocha";
import { assert } from "chai";

import { getFixtureDir, unwind } from "../util.js";

import { ScanResult, scanFiles } from "../../src/scanner.js";

const fixtureDir = getFixtureDir("fixture1");

describe("file scanner", function () {
  it("finds markdown files", async function () {
    const scan = scanFiles(["**/*.md"], [], { basePath: fixtureDir });

    const filePaths: string[] = [];
    for await (const result of scan) {
      filePaths.push(result.file.path);
    }

    assert.sameMembers(filePaths, ["docs/doc1.md", "docs/doc2.md", "README.md"]);
  });

  it("explicitly does not find non-markdown files", async function () {
    const scan = scanFiles(["docs/image.png", "fake"], [], { basePath: fixtureDir });
    const results = await unwind(scan);
    assert.lengthOf(results, 0);
  });

  it("finds links 1", async function () {
    const scan = scanFiles(["README.md"], [], { basePath: fixtureDir });

    const result = (await scan.next()).value as ScanResult;
    assert.isTrue((await scan.next()).done);

    assert.strictEqual(result.file.path, "README.md");

    const hrefs: string[] = [];
    for (const link of result.links) {
      hrefs.push(link.href);
    }

    assert.sameOrderedMembers(hrefs, [
      "./docs/doc1.md",
      "./docs/doc2.md",
      "./docs/doc2.md#cool-stuff",
    ]);
  });

  it("finds links 2", async function () {
    const scan = scanFiles(["docs/doc1.md"], [], { basePath: fixtureDir });

    const result = (await scan.next()).value as ScanResult;
    assert.isTrue((await scan.next()).done);

    assert.strictEqual(result.file.path, "docs/doc1.md");

    const hrefs: string[] = [];
    for (const link of result.links) {
      hrefs.push(link.href);
    }

    assert.sameOrderedMembers(hrefs, [
      "https://google.com",
      "./doc2.md#secret-stuff",
      "./doc2.md#cool-stuff",
    ]);
  });

  it("finds links 3", async function () {
    const scan = scanFiles(["docs/doc2.md"], [], { basePath: fixtureDir });

    const result = (await scan.next()).value as ScanResult;
    assert.isTrue((await scan.next()).done);

    assert.strictEqual(result.file.path, "docs/doc2.md");

    const hrefs: string[] = [];
    for (const link of result.links) {
      hrefs.push(link.href);
    }

    assert.sameOrderedMembers(hrefs, ["image.png", "https://example.com"]);
  });
});
