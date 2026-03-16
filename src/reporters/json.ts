import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SpectralReport } from '../types.js';

export async function writeJsonReport(
  report: SpectralReport,
  outputDir: string,
): Promise<string> {
  await mkdir(outputDir, { recursive: true });

  await Promise.all([
    writeFile(
      join(outputDir, 'design-system.json'),
      JSON.stringify(report, null, 2),
    ),
    writeFile(
      join(outputDir, 'tokens.json'),
      JSON.stringify(report.tokens, null, 2),
    ),
    writeFile(
      join(outputDir, 'components.json'),
      JSON.stringify(report.components, null, 2),
    ),
    writeFile(
      join(outputDir, 'sitemap.json'),
      JSON.stringify(report.sitemap, null, 2),
    ),
  ]);

  return outputDir;
}
