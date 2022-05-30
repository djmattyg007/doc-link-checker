import { describe, it } from "mocha";
import { assert } from "chai";

import { convertHrefToUrl } from "../../src/utils.js";

describe("href-to-URL converter", function () {
  it("converts HTTP hrefs to URL objects", function () {
    const httpUrl = convertHrefToUrl("http://example.com/path1");
    assert.instanceOf(httpUrl, URL);

    const httpsUrl = convertHrefToUrl("https://example.com/path2");
    assert.instanceOf(httpsUrl, URL);
  });

  it("converts non-HTTP hrefs to URL objects", function () {
    const url = convertHrefToUrl("ftp://example.com/path3");
    assert.instanceOf(url, URL);
  });

  it("converts data URI hrefs to URL objects", function () {
    const url = convertHrefToUrl("data:image/png,base64;abcdef1234567890");
    assert.instanceOf(url, URL);
  });

  it("does not convert relative paths", function () {
    assert.isNull(convertHrefToUrl("README.md"));
    assert.isNull(convertHrefToUrl("./docs/getting-started.md"));
    assert.isNull(convertHrefToUrl("assets/flowchart.png"));
    assert.isNull(convertHrefToUrl("../CONTRIBUTING.md"));
  });
});
