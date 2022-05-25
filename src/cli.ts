import { ArgumentParser, BooleanOptionalAction } from "argparse";

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
      default: "commonmark",
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
    caseSensitive: Boolean(parsedArgs["case"]),
    mdType: parsedArgs["md_type"],
  };

  for await (const result of scanFiles(includeGlobs, excludeGlobs, scanOptions)) {
    console.log(result.file.path);
    await verifyLinks(result.file, result.linkRefs);
  }
}
