# Doc Link Checker

[![CI](https://github.com/djmattyg007/doc-link-checker/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/djmattyg007/doc-link-checker/actions/workflows/ci.yml)

Doc Link Checker is designed to verify links in your documentation. Primarily, this is targeted at
verifying internal (relative) references, to ensure broken links are detected early.

At the moment the detection is limited to links and definitions in Markdown files only. Future
support for images and link references is planned, as well as reStructured Text support. Please
see the [ideas list](./ideas.txt) for a full list of currently planned features.

Doc Link Checker is 100% native Typescript.

If you just want to use this as a CLI tool, I recommend taking a look at
[`doc-link-checker-cli`](https://github.com/djmattyg007/doc-link-checker-cli).

## Install

With yarn:

```
$ yarn add doc-link-chcker
```

Or with npm:

```
$ npm add doc-link-checker
```

## Usage

There are two parts to this package - Scanning and Checking.

### Scanning

Scanning involves searching through a selection of files for any kind of link. In this context, a
link is defined as any kind of reference to another part of the same document or any other document.

```typescript
import { scanFiles, ScanOptions } from "doc-link-checker";

// You don't have to pass all options (hence the use of Partial).
// These are all the defaults, which you can override as desired.
const options: Partial<ScanOptions> = {
  basePath: process.cwd(),
  mdType: "commonmark",
  mdFileExts: new Set([".md", ".mdown", ".markdown"]),
  caseSensitive: false,
  globConcurrency: 0,
};

const scan = scanFiles(
  // An array of globs for files that should be scanned
  ["**/*.md"],
  // An array of globs for files that would be matched by include globs,
  // but that should actually be excluded
  ["path/to/*.md"],
  options,
);

// The return value of scanFiles() is an async generator.
// It will only include results for files that it thinks are Markdown files,
// even if the supplied globs match other files.
for await (const result of scan) {
  // Each result object contains two items.
  // The first is a VFile object for the parsed Markdown file.
  console.log(result.file.path);

  // The second is a generator for links found in the parsed document.
  for (const link of links) {
    // Links have three properties.
    // If the link is a valid URL with a protocol, it will include an actual URL object.
    // If it isn't, link.url will be null.
    console.log(link.url.origin);

    // The href is the actual contents of the link in the raw document.
    console.log(link.href);

    // The position contains information about where in the document the link appears.
    // This is useful for linting tools wishing to provide feedback to users.
    // If no position could be determined, link.position will be null. Each position
    // object can include both start and end references with line and column numbers.
    console.log(link.position.start.line);
    console.log(link.position.end.column);
  }
}
```

If your documents are targeting Github Flavoured Markdown, you should supply `gfm` for the `mdType`
option. This impacts how the Markdown files are parsed.

The `mdFileExts` is used to determine which files are actually Markdown files. Only files with these
extensions will be yielded by the scanner, even if other files match the supplied globs. Files with
no extension will never be yielded.

The following options map directly to options supported by the `fast-glob` package, which is used
under the hood to find files:

- `caseSensitive`
- `globConcurrency`

### Checking

Checking links happens on a per-file basis.

Right now, there is no support for checking links that are URLs. These will automatically be skipped.

```typescript
import {
  verifyLinks,
  VerifyLinksOptions,
  FileCheckResponse,
  AnchorCheckResponse,
} from "doc-link-checker";

import { read } from "to-vfile";

const basePath = process.cwd();
// Normally the VFile object and the links iterable would be obtained
// directly from the scanner, rather than retrieving these ourselves.
const readme = await read("README.md");
// VFile objects passed to verifyLinks() must be relative to basePath,
// so we fix it up here manually. This isn't a problem when obtaining
// results from the scanner.
readme.path = "README.md";
const links = [
  // Positions omitted for brevity.
  { href: "docs/intro.md", url: null, position: {...} },
  { href: "docs/advanced.md", url: null, position: {...} },
];

// You don't have to pass all options (hence the use of Partial).
// These are all the defaults, which you can override as desired.
const options: Partial<VerifyLinksOptions> = {
  mdType: "commonmark",
  mdFileExts: new Set([".md", ".mdown", ".markdown"]),
};

const verify = verifyLinks(basePath, file, links, options);

// The return value of verifyLinks() is an async generator. It
// will only include results for actual errors. If there are no
// errors, there will be no results.
for await (const verifyError of verify) {
  // There are two types of errors - those that relate to filenames,
  // and those that relate to anchors.
  if (verifyError.errorType === "file") {
    console.log("error matching filename in link");
    console.log(verifyError.link.href);

    // You can optionally match against error codes, to provide fine-grained
    // feedback to the user. All error codes are described in detail below.
    if (verifyError.errorCode === FileCheckResponse.FILE_OUTSIDE_BASE) {
      console.log("must not target files outside the repository");
    }
  } else if (verifyError.errorType === "anchor") {
    console.log("error matching anchor in link");
    console.log(verifyError.link.href);

    // Errors related to anchors have a different set of error codes. All
    // error codes are described in detail below.
    if (verifyError.errorCode === AnchorCheckResponse.BINARY_FILE) {
      console.log("cannot target binary files with anchors");
    }
  }
}
```

The Markdown-related options have the same meaning as they would for scanning.

The `mdFileExts` option is also used to control what are valid anchors in links:

- Links targeting documents can only use heading anchors
- Links targeting binary files cannot have anchors
- Links targeting non-document text files can only have valid line number targets

#### Error codes

There are two types of errors that can be returned by the checker:

- File errors
- Anchor errors

##### File errors

A file error indicates there was a problem location the file referenced in the link.

**`1` - file doesn't exist**

The file targeted by a link does not exist.

**`2` - file exists outside base directory**

The file targeted by a link exists, but is outside of the base directory (`basePath`). This is
likely a sign of a mistake.

**`3` - convert to pure anchor**

The file targeted by the link is the file which contains the link. In other words, it points to
itself. The link should be converted to a pure anchor.

##### Anchor errors

An anchor error indicates the file referenced in the link exists, but there is a problem with the
heading or line number referred to after the `#` in the link.

**`0` - empty anchor**

The link includes a `#`, but there's nothing after the `#`.

**`1` - binary file**

The link is targeting a binary file, which means there is no useful way to target individual
sections of the file with an anchor.

**`2` - anchor undiscoverable**

The link is targeting a file with no file extension, which means it cannot easily be determined
what the file is or if it contains valid anchor targets.

**`3` - no anchors in filetype**

The link is targeting a non-document file with an anchor that isn't supported for non-document
files.

**`5` - heading match fail**

The link is targeting a document file, and the anchor points to a heading that doesn't exist.

**`7` - line target fail**

The link is targeting a non-document text file, and the anchor is a line number reference that
doesn't exist. Either it points to a single line whose line number is greater than the number of
lines in the target file, or it points to a multi-line range whose end line number is greater than
the number of lines in the target file.

**`8` - line target is invalid**

The link is targeting a non-document text file, and the anchor looks like a line number reference,
but isn't a valid line number reference.

This is a specialised case of error code `3`, designed to help with debugging for end users.

**`9` - multi-line target range is invalid**

The link is targeting a non-document text file, and the anchor is a multi-line range. The start number of the range is greater than or equal to the end number of the range.

### Putting it all together

It's rare that you would want to use the scanner and the checker separately. Here's an example of
how to use the two together.

```typescript
import { scanFiles, verifyFiles } from "doc-link-checker";

const scanOptions = { basePath: "/path/to/documents" };

let foundAnyError = false;
const scan = scanFiles(["**/*.md"], [], scanOptions);
for await (const result of scan) {
  const verify = verifyLinks(scanOptions.basePath, result.file, result.links);
  for await (const verifyError of verify) {
    if (verifyError.errorType === "anchor") {
      // We don't care about anchor errors for some reason.
      continue;
    }

    foundAnyError = true;
    console.log(`file ${result.file.path} has invalid link ${verifyError.link.href}`);
  }
}
if (foundAnyError) {
  process.exit(1);
}
```

### Other interfaces

#### Defaults

The default values for options related to Markdown in `scanFiles` and `verifyLinks` can be imported
from the package, should you wish to use them in your code.

```typescript
import { mdDefaultType, mdDefaultFileExts } from "doc-link-checker";
```

## Backwards compatibility

This project aims to follow [semantic versioning](https://semver.org).

The only public interface for this package is what can be imported directly from the package's
`main` file. Nested imports are not supported, and the internal organisation of the code could
change at any time.

What the checker reports as an error may change with minor version bumps. The maintainers
endeavour to ensure it will not change with patch version bumps.

## Development

### Typescript

The code is written in Typescript. You can check that the code compiles successfully by running
`tsc` like so:

```
$ yarn run build
```

### Linting

The tool `xo` is used for linting the code. This wraps `eslint` and `prettier` with a strict set of
default rules. You can run `xo` like so:

```
$ yarn run lint
```

### Tests

The tests are written using `mocha` and `chai`. You can run them like so:

```
$ yarn run test
```

### Debugging

You can get the full tree of Markdown nodes used when scanning files quickly and easily by running
the following command:

```
$ yarn run md-tree path/to/file.md
```

## Contributing

All contributions are welcome! Please make sure that any code changes are accompanied by updated
tests. I also recommend running prettier before committing, like so:

```
$ yarn run reformat
```

## License

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, version 3 of the License.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see https://www.gnu.org/licenses/.
