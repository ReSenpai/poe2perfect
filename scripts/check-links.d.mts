/** The links that don't answer with an image, each with the reason (scripts/check-links.mjs). */
export function brokenLinks(urls: readonly string[], fetch: (url: string) => Promise<Response>): Promise<string[]>;
