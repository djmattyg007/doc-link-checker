import { describe, it } from "mocha";
import { assert } from "chai";

import { getFixtureDir, unwind } from "../util.js";

import { ScanResult, scanFiles } from "../../src/scanner.js";

const fixtureDir = getFixtureDir("fixture2");

describe("file scanner", function () {
  it("finds markdown files", async function () {
    const scan = scanFiles(["**/*.md"], [], { basePath: fixtureDir });

    const filePaths: string[] = [];
    for await (const result of scan) {
      filePaths.push(result.file.path);
    }

    assert.sameMembers(filePaths, ["docs/doc.md"]);
  });

  it("explicitly does not find non-markdown files", async function () {
    const scan = scanFiles(["test.txt"], [], { basePath: fixtureDir });
    const results = await unwind(scan);
    assert.lengthOf(results, 0);
  });

  it("finds links 1", async function () {
    const scan = scanFiles(["docs/doc.md"], [], { basePath: fixtureDir });

    const result = (await scan.next()).value as ScanResult;
    assert.isTrue((await scan.next()).done);

    assert.strictEqual(result.file.path, "docs/doc.md");

    const hrefs: string[] = [];
    for (const link of result.links) {
      hrefs.push(link.href);
    }

    assert.sameOrderedMembers(hrefs, ["./doc.md#a-heading"]);
  });
});
