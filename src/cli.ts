#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { analyze } from './index.js';
import { DEFAULT_CONFIG } from './types.js';
import type { SpectralConfig } from './types.js';

const banner = `
  ${chalk.cyan('╔═══════════════════════════════════════╗')}
  ${chalk.cyan('║')}   ${chalk.bold.white('SPECTRAL')} ${chalk.dim('— Design System Scanner')}   ${chalk.cyan('║')}
  ${chalk.cyan('╚═══════════════════════════════════════╝')}
`;

const program = new Command();

program
  .name('spectral')
  .description('Reverse-engineer a website\'s design system')
  .version('0.1.0')
  .argument('<url>', 'URL to analyze')
  .option('-p, --max-pages <n>', 'Max pages to crawl', String(DEFAULT_CONFIG.maxPages))
  .option('-d, --depth <n>', 'Max crawl depth', String(DEFAULT_CONFIG.depth))
  .option('--no-sitemap', 'Skip sitemap crawling')
  .option('--screenshots', 'Capture page screenshots')
  .option('-f, --format <type>', 'Output format: json, markdown, both', DEFAULT_CONFIG.outputFormat)
  .option('-o, --output <dir>', 'Output directory', DEFAULT_CONFIG.outputDir)
  .option('--no-headless', 'Show browser window')
  .option('-t, --timeout <ms>', 'Page timeout in ms', String(DEFAULT_CONFIG.timeout))
  .action(async (url: string, opts) => {
    console.log(banner);

    const config: SpectralConfig = {
      url,
      maxPages: parseInt(opts.maxPages, 10),
      depth: parseInt(opts.depth, 10),
      includeSitemap: opts.sitemap !== false,
      includeScreenshots: opts.screenshots ?? false,
      outputFormat: opts.format as SpectralConfig['outputFormat'],
      outputDir: opts.output,
      headless: opts.headless !== false,
      timeout: parseInt(opts.timeout, 10),
    };

    const spinner = ora({
      text: `Analyzing ${chalk.bold(url)}...`,
      color: 'cyan',
    }).start();

    try {
      const report = await analyze(config);

      spinner.succeed(chalk.green('Analysis complete!'));
      console.log();
      console.log(chalk.bold('  Summary'));
      console.log(chalk.dim('  ─────────────────────────────────────'));
      console.log(`  ${chalk.cyan('Pages analyzed:')}      ${report.meta.pagesAnalyzed}`);
      console.log(`  ${chalk.cyan('Unique colors:')}       ${report.tokens.colors.length}`);
      console.log(`  ${chalk.cyan('Typography styles:')}   ${report.tokens.typography.length}`);
      console.log(`  ${chalk.cyan('Spacing values:')}      ${report.tokens.spacing.length}`);
      console.log(`  ${chalk.cyan('Components detected:')} ${report.components.length}`);
      console.log(`  ${chalk.cyan('Duration:')}            ${(report.meta.duration / 1000).toFixed(1)}s`);
      console.log();
      console.log(`  ${chalk.dim('Output:')} ${chalk.underline(config.outputDir)}`);
      console.log();
    } catch (err) {
      spinner.fail(chalk.red('Analysis failed'));
      console.error(chalk.red(`\n  ${(err as Error).message}`));
      process.exit(1);
    }
  });

program.parse();
