export function determineHrefType(href: string): URL | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch (err) {
    if (err instanceof TypeError) {
      return null;
    }
    throw err;
  }

  return url;
}
