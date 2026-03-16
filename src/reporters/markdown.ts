import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  SpectralReport,
  ColorToken,
  DetectedComponent,
  LayoutNode,
  SitemapPage,
} from '../types.js';

export async function writeMarkdownReport(
  report: SpectralReport,
  outputDir: string,
): Promise<string> {
  await mkdir(outputDir, { recursive: true });

  const md = buildMarkdown(report);
  await writeFile(join(outputDir, 'DESIGN-SYSTEM.md'), md);

  return outputDir;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}

function getHueFamily(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  if (delta < 0.01) {
    if (max > 0.9) return 'White';
    if (max < 0.1) return 'Black';
    return 'Gray';
  }

  let hue = 0;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue = Math.round(hue * 60);
  if (hue < 0) hue += 360;

  if (hue < 15 || hue >= 345) return 'Red';
  if (hue < 45) return 'Orange';
  if (hue < 70) return 'Yellow';
  if (hue < 160) return 'Green';
  if (hue < 200) return 'Cyan';
  if (hue < 260) return 'Blue';
  if (hue < 300) return 'Purple';
  return 'Pink';
}

function groupColorsByHue(colors: ColorToken[]): Map<string, ColorToken[]> {
  const groups = new Map<string, ColorToken[]>();
  for (const color of colors) {
    const family = getHueFamily(color.hex);
    const list = groups.get(family) ?? [];
    list.push(color);
    groups.set(family, list);
  }
  return groups;
}

function renderLayoutTree(node: LayoutNode, indent = 0): string {
  const prefix = '  '.repeat(indent);
  const label = node.role ? `${node.tag} [${node.role}]` : node.tag;
  const comp = node.componentType ? ` (${node.componentType})` : '';
  let result = `${prefix}- \`${label}\`${comp}\n`;
  for (const child of node.children) {
    result += renderLayoutTree(child, indent + 1);
  }
  return result;
}

function renderSitemapTree(pages: SitemapPage[]): string {
  const sorted = [...pages].sort((a, b) => a.depth - b.depth || a.url.localeCompare(b.url));
  let result = '';
  for (const page of sorted) {
    const indent = '  '.repeat(page.depth);
    const compCount = page.components.reduce((sum, c) => sum + c.count, 0);
    result += `${indent}- [${page.title || page.url}](${page.url}) — ${compCount} components\n`;
  }
  return result;
}

function buildMarkdown(report: SpectralReport): string {
  const { url, analyzedAt, tokens, components, layouts, sitemap, meta } = report;
  const lines: string[] = [];

  const push = (...strs: string[]) => {
    for (const s of strs) lines.push(s);
  };

  // Header
  push(
    '# Spectral Design System Report',
    '',
    `> Analyzed: **${url}** | ${analyzedAt} | ${meta.pagesAnalyzed} pages | ${formatDuration(meta.duration)}`,
    '',
    '---',
    '',
  );

  // ── Color Palette ──
  push('## Color Palette', '');
  const hueGroups = groupColorsByHue(tokens.colors);
  for (const [family, colors] of hueGroups) {
    push(`### ${family}`, '');
    push('| Swatch | Name | Hex | Occurrences | Used In |');
    push('|--------|------|-----|-------------|---------|');
    for (const c of colors) {
      const swatch = `![${c.hex}](https://via.placeholder.com/24/${c.hex.slice(1)}/${c.hex.slice(1)})`;
      const name = c.name ?? '—';
      push(`| ${swatch} | ${name} | \`${c.hex}\` | ${c.occurrences} | ${c.properties.join(', ')} |`);
    }
    push('');
  }

  // ── Typography Scale ──
  push('## Typography Scale', '');
  push('| Sample | Font Family | Size | Weight | Line Height | Used By |');
  push('|--------|-------------|------|--------|-------------|---------|');
  for (const t of tokens.typography) {
    const sample = `**Aa** (${t.fontSize})`;
    push(
      `| ${sample} | ${t.fontFamily} | ${t.fontSize} | ${t.fontWeight} | ${t.lineHeight} | ${t.elements.join(', ')} |`,
    );
  }
  push('');

  // ── Spacing Scale ──
  push('## Spacing Scale', '');
  const sortedSpacing = [...tokens.spacing].sort(
    (a, b) => a.normalizedPx - b.normalizedPx,
  );
  if (sortedSpacing.length > 0) {
    const maxPx = sortedSpacing[sortedSpacing.length - 1].normalizedPx || 1;
    push('```');
    for (const s of sortedSpacing) {
      const barLen = Math.max(1, Math.round((s.normalizedPx / maxPx) * 40));
      push(`${s.value.padStart(8)} ${'█'.repeat(barLen)}`);
    }
    push('```');
    push('');
  }
  push('| Value | Pixels | Occurrences | Properties |');
  push('|-------|--------|-------------|------------|');
  for (const s of sortedSpacing) {
    push(
      `| \`${s.value}\` | ${s.normalizedPx}px | ${s.occurrences} | ${s.properties.join(', ')} |`,
    );
  }
  push('');

  // ── Shadows ──
  push('## Shadows', '');
  if (tokens.shadows.length === 0) {
    push('_No shadows detected._', '');
  } else {
    for (const s of tokens.shadows) {
      push(`- \`${s.value}\` — ${s.occurrences} occurrence${s.occurrences !== 1 ? 's' : ''}`);
    }
    push('');
  }

  // ── Border Radius Scale ──
  push('## Border Radius Scale', '');
  const sortedRadii = [...tokens.radii].sort(
    (a, b) => a.normalizedPx - b.normalizedPx,
  );
  if (sortedRadii.length > 0) {
    push('```');
    for (const r of sortedRadii) {
      const barLen = Math.max(1, Math.min(20, Math.round(r.normalizedPx / 2)));
      push(`${r.value.padStart(8)} ${'●'.repeat(barLen)}`);
    }
    push('```');
    push('');
  }
  push('| Value | Pixels | Occurrences |');
  push('|-------|--------|-------------|');
  for (const r of sortedRadii) {
    push(`| \`${r.value}\` | ${r.normalizedPx}px | ${r.occurrences} |`);
  }
  push('');

  // ── Components ──
  push('## Components', '');
  if (components.length === 0) {
    push('_No components detected._', '');
  } else {
    const grouped = groupComponents(components);
    for (const [type, comps] of grouped) {
      const totalCount = comps.reduce((s, c) => s + c.count, 0);
      const totalVariants = comps.reduce((s, c) => s + c.variants.length, 0);
      const label = type.charAt(0).toUpperCase() + type.slice(1);
      push(`### ${label} (${totalCount} instances, ${totalVariants} variants)`, '');

      for (const comp of comps) {
        push(`**\`${comp.selector}\`** — ${comp.count} instances`, '');

        push('Sample HTML:', '');
        push('```html', comp.sample.html, '```', '');

        const styleEntries = Object.entries(comp.sample.styles);
        if (styleEntries.length > 0) {
          push('Key styles:', '');
          for (const [prop, val] of styleEntries) {
            push(`- \`${prop}: ${val}\``);
          }
          push('');
        }

        if (comp.variants.length > 0) {
          push('Variants:', '');
          for (const v of comp.variants) {
            const diffs = Object.entries(v.differingStyles)
              .map(([p, val]) => `${p}: ${val}`)
              .join(', ');
            push(`- **${v.name}** (\`${v.selector}\`, ${v.count}x) — ${diffs}`);
          }
          push('');
        }

        push(`Pages: ${comp.pages.map((p) => `[${p}](${p})`).join(', ')}`, '');
      }
    }
  }

  // ── Layout Patterns ──
  push('## Layout Patterns', '');
  if (layouts.length === 0) {
    push('_No layout patterns detected._', '');
  } else {
    for (const page of layouts) {
      push(`### ${page.title || page.url}`, '');

      if (page.layouts.length > 0) {
        push('Layout structures:', '');
        for (const l of page.layouts) {
          push(
            `- **${l.type}** \`${l.selector}\` — ${l.children} children, ${l.occurrences} occurrences`,
          );
        }
        push('');
      }

      push('Structure:', '');
      push(renderLayoutTree(page.structure));
    }
  }

  // ── Sitemap ──
  push('## Sitemap', '');
  if (sitemap.pages.length === 0) {
    push('_No pages crawled._', '');
  } else {
    push(renderSitemapTree(sitemap.pages));
  }

  // ── Meta ──
  push('---', '');
  push('## Meta', '');
  push(`- **Pages analyzed:** ${meta.pagesAnalyzed}`);
  push(`- **Total components:** ${meta.totalComponents}`);
  push(`- **Total tokens:** ${meta.totalTokens}`);
  push(`- **Duration:** ${formatDuration(meta.duration)}`);
  push(`- **Crawled at:** ${sitemap.crawledAt}`);
  push('');

  return lines.join('\n');
}

function groupComponents(
  components: DetectedComponent[],
): Map<string, DetectedComponent[]> {
  const map = new Map<string, DetectedComponent[]>();
  for (const comp of components) {
    const list = map.get(comp.type) ?? [];
    list.push(comp);
    map.set(comp.type, list);
  }
  return map;
}
