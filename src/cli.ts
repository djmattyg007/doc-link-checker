import { ArgumentParser, BooleanOptionalAction } from "argparse";

import { mdDefaultType } from "./filetypes.js";
import { scanFiles } from "./scanner.js";
import { verifyLinks } from "./checker.js";

export const DEFAULT_INCLUDE_GLOBS: ReadonlyArray<string> = ["**/*.md", "**/*.markdown"];
export const DEFAULT_EXCLUDE_GLOBS: ReadonlyArray<string> = ["**/node_modules/**/*", "**/.venv/*", "**/venv/*", "**/vendor/*"];

export function prepareParser(): ArgumentParser {
  const parser = new ArgumentParser(
    {
      description: "Verify that links in documentation are valid.",
    },
  );

  parser.add_argument(
    "--case",
    {
      action: BooleanOptionalAction,
      help: "Specify this option to make glob matching case-sensitive. Defaults to case-insensitive.",
    },
  );
  parser.add_argument(
    "--md-type",
    {
      choices: ["commonmark", "gfm"],
      default: mdDefaultType,
      help: "Use a custom markdown parser. Defaults to standard commonmark.",
    },
  );
  parser.add_argument(
    "--include",
    {
      action: "append",
      help: "A glob string to match files that should be checked. Can specify multiple times.",
    },
  );
  parser.add_argument(
    "--exclude",
    {
      action: "append",
      help: "A glob string to match files that should NOT be checked. Can specify multiple times.",
    },
  );

  return parser;
}

export async function main(args?: ReadonlyArray<string>): Promise<void> {
  const argsToParse = args ? args.slice() : process.argv.slice(2);

  const parser = prepareParser();
  const parsedArgs = parser.parse_args(argsToParse);

  const includeGlobs = parsedArgs.include ? parsedArgs.include : DEFAULT_INCLUDE_GLOBS;
  const excludeGlobs = parsedArgs.exclude ? parsedArgs.exclude : DEFAULT_EXCLUDE_GLOBS;

  const scanOptions = {
    basePath: process.cwd(),
    caseSensitive: Boolean(parsedArgs["case"]),
    mdType: parsedArgs["md_type"],
  };

  let foundAnyError = false;
  for await (const result of scanFiles(includeGlobs, excludeGlobs, scanOptions)) {
    let foundError = false;
    for await (const verifyError of verifyLinks(scanOptions.basePath, result.file, result.linkRefs)) {
      if (foundError === false) {
        console.log("---", result.file.path, "---");
        foundError = true;
      }

      const position = verifyError.link.position;
      const lineMarker = position ? String(position.start.line) : "?";
      console.log("line %s: %s (%s error %d)", lineMarker, verifyError.link.href, verifyError.errorType, verifyError.errorCode);
    }

    if (foundError === true) {
      foundAnyError = true;
    } else {
      console.log(result.file.path, "[OK]");
    }
  }

  if (foundAnyError === true) {
    process.exit(1);
  }
}
