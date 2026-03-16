import type { Browser } from 'playwright';
import type { SpectralConfig, Sitemap, SitemapPage } from './types.js';
import { createPage, waitForPage } from './utils/browser.js';

const SKIP_EXTENSIONS = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif',
  '.ico', '.mp4', '.webm', '.mp3', '.wav', '.ogg', '.zip', '.tar',
  '.gz', '.rar', '.7z', '.exe', '.dmg', '.doc', '.docx', '.xls',
  '.xlsx', '.ppt', '.pptx', '.csv', '.xml', '.rss', '.atom',
]);

function normalizeUrl(raw: string, baseOrigin: string): string | null {
  try {
    const url = new URL(raw, baseOrigin);

    // Only follow http(s) links
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    // Must be same origin
    if (url.origin !== baseOrigin) {
      return null;
    }

    // Skip non-HTML resources by extension
    const pathname = url.pathname.toLowerCase();
    for (const ext of SKIP_EXTENSIONS) {
      if (pathname.endsWith(ext)) {
        return null;
      }
    }

    // Strip hash
    url.hash = '';

    // Remove trailing slash (but keep root "/")
    let normalized = url.toString();
    if (normalized.endsWith('/') && url.pathname !== '/') {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  } catch {
    return null;
  }
}

export async function crawlSite(
  config: SpectralConfig,
  browser: Browser,
): Promise<Sitemap> {
  const baseOrigin = new URL(config.url).origin;
  const visited = new Set<string>();
  const pages: SitemapPage[] = [];

  // BFS queue: [url, depth]
  const queue: [string, number][] = [];

  // Seed with the starting URL (normalized)
  const startUrl = normalizeUrl(config.url, baseOrigin) ?? config.url;
  queue.push([startUrl, 0]);
  visited.add(startUrl);

  const page = await createPage(browser, config.timeout);

  try {
    while (queue.length > 0 && pages.length < config.maxPages) {
      const [url, depth] = queue.shift()!;

      let status = 0;
      let title = '';
      let links: string[] = [];

      try {
        const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
        status = response?.status() ?? 0;

        // Only process successful HTML responses
        const contentType = response?.headers()['content-type'] ?? '';
        if (status >= 200 && status < 400 && contentType.includes('text/html')) {
          await waitForPage(page);

          title = await page.title();

          // Extract links if we haven't hit max depth
          if (depth < config.depth) {
            links = await page.$$eval('a[href]', (anchors) =>
              anchors.map((a) => a.getAttribute('href') ?? ''),
            );
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[spectral] Failed to crawl ${url}: ${message}`);
      }

      pages.push({
        url,
        title,
        depth,
        status,
        components: [],
        layout: { tag: 'body', selector: 'body', display: 'block', children: [] },
      });

      // Enqueue discovered links
      for (const href of links) {
        const normalized = normalizeUrl(href, baseOrigin);
        if (normalized && !visited.has(normalized)) {
          visited.add(normalized);
          queue.push([normalized, depth + 1]);
        }
      }
    }
  } finally {
    await page.close();
  }

  return {
    baseUrl: baseOrigin,
    pages,
    crawledAt: new Date().toISOString(),
  };
}
