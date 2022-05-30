export function convertHrefToUrl(href: string): URL | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch (error) {
    if (error instanceof TypeError) {
      return null;
    }
    throw error;
  }

  return url;
}
