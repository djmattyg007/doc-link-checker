import tsheredoc from "tsheredoc";

export function* enumerate<T>(
  iterator: Iterable<T>,
  { start = 0 }: Partial<{ start: number }> = {},
): Generator<[number, T]> {
  let counter = start;
  for (const value of iterator) {
    yield [counter, value];
    counter++;
  }
}

// For reasons I don't understand, Typescript can't seem to properly
// handle default exports from commonjs packages.
// @ts-expect-error
export const heredoc = tsheredoc.default as typeof tsheredoc;

export function unwindSync<T>(iterator: Iterable<T>): T[] {
  const result: T[] = [];
  for (const value of iterator) {
    result.push(value);
  }
  return result;
}
