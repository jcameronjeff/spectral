import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DesignTokens } from '../types.js';

interface W3CToken {
  $value: unknown;
  $type: string;
  $description?: string;
}

interface W3CGroup {
  [key: string]: W3CToken | W3CGroup;
}

export async function writeFigmaTokens(
  tokens: DesignTokens,
  outputDir: string,
): Promise<string> {
  await mkdir(outputDir, { recursive: true });

  const output: W3CGroup = {
    color: buildColorGroup(tokens),
    typography: buildTypographyGroup(tokens),
    spacing: buildSpacingGroup(tokens),
    shadow: buildShadowGroup(tokens),
    borderRadius: buildBorderRadiusGroup(tokens),
  };

  const filePath = join(outputDir, 'design-tokens.json');
  await writeFile(filePath, JSON.stringify(output, null, 2));

  return outputDir;
}

function buildColorGroup(tokens: DesignTokens): W3CGroup {
  const group: W3CGroup = {};
  for (const color of tokens.colors) {
    const key = color.name ?? color.hex.replace('#', 'color-');
    group[key] = {
      $value: color.hex,
      $type: 'color',
      $description: `Used in: ${color.properties.join(', ')} (${color.occurrences} occurrences)`,
    };
  }
  return group;
}

function buildTypographyGroup(tokens: DesignTokens): W3CGroup {
  const group: W3CGroup = {};
  for (let i = 0; i < tokens.typography.length; i++) {
    const t = tokens.typography[i];
    const key = `type-${i}`;
    group[key] = {
      $value: {
        fontFamily: t.fontFamily,
        fontSize: t.fontSize,
        fontWeight: t.fontWeight,
        lineHeight: t.lineHeight,
        letterSpacing: t.letterSpacing,
      },
      $type: 'typography',
      $description: `Used by: ${t.elements.join(', ')} (${t.occurrences} occurrences)`,
    };
  }
  return group;
}

function buildSpacingGroup(tokens: DesignTokens): W3CGroup {
  const group: W3CGroup = {};
  const sorted = [...tokens.spacing].sort(
    (a, b) => a.normalizedPx - b.normalizedPx,
  );
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    const key = `space-${i}`;
    group[key] = {
      $value: s.value,
      $type: 'dimension',
      $description: `${s.normalizedPx}px — ${s.properties.join(', ')} (${s.occurrences} occurrences)`,
    };
  }
  return group;
}

function buildShadowGroup(tokens: DesignTokens): W3CGroup {
  const group: W3CGroup = {};
  for (let i = 0; i < tokens.shadows.length; i++) {
    const s = tokens.shadows[i];
    const key = `shadow-${i}`;
    group[key] = {
      $value: s.value,
      $type: 'shadow',
      $description: `${s.occurrences} occurrences`,
    };
  }
  return group;
}

function buildBorderRadiusGroup(tokens: DesignTokens): W3CGroup {
  const group: W3CGroup = {};
  const sorted = [...tokens.radii].sort(
    (a, b) => a.normalizedPx - b.normalizedPx,
  );
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    const key = `radius-${i}`;
    group[key] = {
      $value: r.value,
      $type: 'dimension',
      $description: `${r.normalizedPx}px (${r.occurrences} occurrences)`,
    };
  }
  return group;
}
