import { createBrowser, createPage, closeBrowser, waitForPage } from './utils/browser.js';
import { crawlSite } from './crawler.js';
import { extractTokens } from './extractors/tokens.js';
import { detectComponents } from './extractors/components.js';
import { analyzeLayouts } from './extractors/layouts.js';
import { nameColors } from './analyzers/color.js';
import { detectSpacingScale } from './analyzers/spacing.js';
import { writeJsonReport } from './reporters/json.js';
import { writeMarkdownReport } from './reporters/markdown.js';
import { writeFigmaTokens } from './reporters/figma.js';
import type { SpectralConfig, SpectralReport, PageLayout, DetectedComponent } from './types.js';

export async function analyze(config: SpectralConfig): Promise<SpectralReport> {
  const startTime = Date.now();

  // 1. Launch browser
  const browser = await createBrowser(config.headless);

  try {
    // 2. Navigate to main URL and extract tokens, components, layouts
    const page = await createPage(browser, config.timeout);
    await page.goto(config.url, { waitUntil: 'networkidle' });
    await waitForPage(page);

    const tokens = await extractTokens(page);
    const mainComponents = await detectComponents(page);
    const mainLayoutResult = await analyzeLayouts(page);

    // Tag components with the current page URL
    for (const comp of mainComponents) {
      comp.pages = [config.url];
    }

    const allComponents: DetectedComponent[] = [...mainComponents];
    const allLayouts: PageLayout[] = [{
      url: config.url,
      title: await page.title(),
      structure: mainLayoutResult.structure,
      layouts: mainLayoutResult.layouts,
    }];

    await page.close();

    // 3. If sitemap enabled, crawl the site
    let sitemap = {
      baseUrl: config.url,
      pages: [],
      crawledAt: new Date().toISOString(),
    } as SpectralReport['sitemap'];

    if (config.includeSitemap) {
      sitemap = await crawlSite(config, browser);
    }

    // 4. For each crawled page, detect components and layouts
    for (let i = 0; i < sitemap.pages.length; i++) {
      const sitemapPage = sitemap.pages[i];
      console.log(`  Analyzing page ${i + 1}/${sitemap.pages.length}: ${sitemapPage.url}`);

      const crawlPage = await createPage(browser, config.timeout);
      try {
        await crawlPage.goto(sitemapPage.url, { waitUntil: 'networkidle' });
        await waitForPage(crawlPage);

        const pageComponents = await detectComponents(crawlPage);
        for (const comp of pageComponents) {
          comp.pages = [sitemapPage.url];
        }

        const pageLayoutResult = await analyzeLayouts(crawlPage);
        const pageLayout: PageLayout = {
          url: sitemapPage.url,
          title: sitemapPage.title,
          structure: pageLayoutResult.structure,
          layouts: pageLayoutResult.layouts,
        };

        allComponents.push(...pageComponents);
        allLayouts.push(pageLayout);
      } catch (err) {
        console.log(`  Skipping ${sitemapPage.url}: ${(err as Error).message}`);
      } finally {
        await crawlPage.close();
      }
    }

    // 5. Merge component data — dedupe by selector, sum counts, track pages
    const componentMap = new Map<string, DetectedComponent>();
    for (const comp of allComponents) {
      const existing = componentMap.get(comp.selector);
      if (existing) {
        existing.count += comp.count;
        for (const pageUrl of comp.pages) {
          if (!existing.pages.includes(pageUrl)) {
            existing.pages.push(pageUrl);
          }
        }
        for (const variant of comp.variants) {
          const existingVariant = existing.variants.find((v) => v.selector === variant.selector);
          if (existingVariant) {
            existingVariant.count += variant.count;
          } else {
            existing.variants.push(variant);
          }
        }
      } else {
        componentMap.set(comp.selector, { ...comp });
      }
    }
    const mergedComponents = Array.from(componentMap.values());

    // 6. Run analyzers on collected tokens
    const namedColors = nameColors(tokens.colors);
    const spacingScale = detectSpacingScale(tokens.spacing);

    const analyzedTokens = {
      ...tokens,
      colors: namedColors,
      spacing: spacingScale,
    };

    // 7. Build the report
    const duration = Date.now() - startTime;
    const report: SpectralReport = {
      url: config.url,
      analyzedAt: new Date().toISOString(),
      tokens: analyzedTokens,
      components: mergedComponents,
      layouts: allLayouts,
      sitemap,
      meta: {
        pagesAnalyzed: allLayouts.length,
        totalComponents: mergedComponents.reduce((sum, c) => sum + c.count, 0),
        totalTokens:
          analyzedTokens.colors.length +
          analyzedTokens.typography.length +
          analyzedTokens.spacing.length +
          analyzedTokens.shadows.length +
          analyzedTokens.borders.length +
          analyzedTokens.radii.length,
        duration,
      },
    };

    // 8. Write reports based on outputFormat
    if (config.outputFormat === 'json' || config.outputFormat === 'both') {
      await writeJsonReport(report, config.outputDir);
    }
    if (config.outputFormat === 'markdown' || config.outputFormat === 'both') {
      await writeMarkdownReport(report, config.outputDir);
    }
    await writeFigmaTokens(report.tokens, config.outputDir);

    // 9. Return report
    return report;
  } finally {
    await closeBrowser(browser);
  }
}
