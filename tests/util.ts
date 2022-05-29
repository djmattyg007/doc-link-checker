import path from "path";
import url from "url";

import tsheredoc from "tsheredoc";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

export async function* enumerate<T>(
  iterator: AsyncIterable<T>,
  { start = 0 }: Partial<{ start: number }> = {},
): AsyncGenerator<[number, T]> {
  let counter = start;
  for await (const value of iterator) {
    yield [counter, value];
    counter++;
  }
}

export function* enumerateSync<T>(
  iterator: Iterable<T>,
  { start = 0 }: Partial<{ start: number }> = {},
): Generator<[number, T]> {
  let counter = start;
  for (const value of iterator) {
    yield [counter, value];
    counter++;
  }
}

const fixtureDir = path.join(__dirname, "fixtures");
export function getFixtureDir(name: string): string {
  return path.join(fixtureDir, name);
}

// For reasons I don't understand, Typescript can't seem to properly
// handle default exports from commonjs packages.
// @ts-expect-error
export const heredoc = tsheredoc.default as typeof tsheredoc;

export async function unwind<T>(iterator: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const value of iterator) {
    result.push(value);
  }
  return result;
}

export function unwindSync<T>(iterator: Iterable<T>): T[] {
  const result: T[] = [];
  for (const value of iterator) {
    result.push(value);
  }
  return result;
}
