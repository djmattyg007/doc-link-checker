import { ArgumentParser, BooleanOptionalAction } from "argparse";

import { mdDefaultType } from "./filetypes.js";
import { scanFiles } from "./scanner.js";
import { verifyLinks } from "./checker.js";

export const DEFAULT_INCLUDE_GLOBS: ReadonlyArray<string> = [
  "**/*.md",
  "**/*.mdown",
  "**/*.markdown",
];
export const DEFAULT_EXCLUDE_GLOBS: ReadonlyArray<string> = [
  "**/node_modules/**",
  "**/.venv/**",
  "**/venv/**",
  "**/vendor/**",
];

export function prepareParser(): ArgumentParser {
  const parser = new ArgumentParser({
    description: "Verify that links in documentation are valid.",
  });

  parser.add_argument("--case", {
    action: BooleanOptionalAction,
    help: "Specify this option to make glob matching case-sensitive. Defaults to case-insensitive.",
  });
  parser.add_argument("--md-type", {
    choices: ["commonmark", "gfm"],
    default: mdDefaultType,
    help: "Use a custom markdown parser. Defaults to standard commonmark.",
  });

  parser.add_argument("--include", {
    action: "append",
    help: "A glob string to match files that should be checked. Can specify multiple times.",
  });
  parser.add_argument("--include-extend", {
    action: "append",
    help: "A glob string added to the default include glob strings to match files that should be checked. Can specify multiple times.",
  });
  parser.add_argument("--exclude", {
    action: "append",
    help: "A glob string to match files that should NOT be checked. Can specify multiple times.",
  });
  parser.add_argument("--exclude-extend", {
    action: "append",
    help: "A glob string added to the default exclude glob strings to match files that should NOT be checked. Can specify multiple times.",
  });

  parser.add_argument("--success-code", {
    type: Number,
    default: 0,
    help: "The status code to exit with when there are no errors.",
  });
  parser.add_argument("--failure-code", {
    type: Number,
    default: 1,
    help: "The status code to exit with when there are errors.",
  });

  return parser;
}

export async function main(args?: ReadonlyArray<string>): Promise<number> {
  const argsToParse = args ? args.slice() : process.argv.slice(2);

  const parser = prepareParser();
  const parsedArgs = parser.parse_args(argsToParse);

  const includeGlobs = parsedArgs.include
    ? parsedArgs.include
    : DEFAULT_INCLUDE_GLOBS.concat(
        parsedArgs["include_extend"] ? parsedArgs["include_extend"] : [],
      );
  const excludeGlobs = parsedArgs.exclude
    ? parsedArgs.exclude
    : DEFAULT_EXCLUDE_GLOBS.concat(
        parsedArgs["exclude_extend"] ? parsedArgs["exclude_extend"] : [],
      );

  const scanOptions = {
    basePath: process.cwd(),
    caseSensitive: Boolean(parsedArgs["case"]),
    mdType: parsedArgs["md_type"],
  };

  let foundAnyError = false;
  const scan = scanFiles(includeGlobs, excludeGlobs, scanOptions);
  for await (const result of scan) {
    let foundError = false;
    const verify = verifyLinks(scanOptions.basePath, result.file, result.links);
    for await (const verifyError of verify) {
      if (foundError === false) {
        console.log("---", result.file.path, "---");
        foundError = true;
      }

      const position = verifyError.link.position;
      const lineMarker = position ? String(position.start.line) : "?";
      console.log(
        "line %s: %s (%s error %d)",
        lineMarker,
        verifyError.link.href,
        verifyError.errorType,
        verifyError.errorCode,
      );
    }

    if (foundError === true) {
      foundAnyError = true;
    } else {
      console.log(result.file.path, "[OK]");
    }
  }

  if (foundAnyError === true) {
    return parsedArgs["failure_code"];
  } else {
    return parsedArgs["sucess_code"];
  }
}
