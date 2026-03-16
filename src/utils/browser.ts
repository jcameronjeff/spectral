import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const DISABLE_ANIMATIONS_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    scroll-behavior: auto !important;
  }
`;

export async function createBrowser(headless: boolean): Promise<Browser> {
  const browser = await chromium.launch({
    headless,
    channel: 'chrome',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });
  return browser;
}

export async function createPage(browser: Browser, timeout: number): Promise<Page> {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    userAgent: DEFAULT_USER_AGENT,
  });

  page.setDefaultTimeout(timeout);
  page.setDefaultNavigationTimeout(timeout);

  await page.addInitScript(() => {
    // Hide webdriver flag
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    // Disable smooth scrolling at the document level
    document.documentElement.style.scrollBehavior = 'auto';
  });

  // Inject CSS to disable animations on every frame navigation
  page.on('framenavigated', async (frame) => {
    if (frame === page.mainFrame()) {
      try {
        await page.addStyleTag({ content: DISABLE_ANIMATIONS_CSS });
      } catch {
        // Page may have been closed or navigated away
      }
    }
  });

  return page;
}

export async function waitForPage(page: Page): Promise<void> {
  await Promise.all([
    page.waitForLoadState('domcontentloaded'),
    page.waitForLoadState('networkidle'),
  ]);
}

export async function closeBrowser(browser: Browser): Promise<void> {
  await browser.close();
}
