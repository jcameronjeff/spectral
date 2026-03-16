import type { Page } from 'playwright';
import type { DesignTokens } from '../types.js';

export async function extractTokens(page: Page): Promise<DesignTokens> {
  return page.evaluate(() => {
    // ── Helpers ───────────────────────────────────────────────────

    function rgbToHex(r: number, g: number, b: number): string {
      return (
        '#' +
        [r, g, b]
          .map((c) => Math.round(c).toString(16).padStart(2, '0'))
          .join('')
      );
    }

    function parseColor(raw: string): string | null {
      if (!raw || raw === 'transparent' || raw === 'rgba(0, 0, 0, 0)') return null;

      // rgb(r, g, b) or rgba(r, g, b, a)
      const rgbaMatch = raw.match(
        /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/,
      );
      if (rgbaMatch) {
        const a = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1;
        if (a === 0) return null;
        return rgbToHex(+rgbaMatch[1], +rgbaMatch[2], +rgbaMatch[3]);
      }

      // Already hex
      if (raw.startsWith('#')) {
        const hex = raw.replace('#', '');
        if (hex.length === 3) {
          return '#' + hex.split('').map((c) => c + c).join('');
        }
        return '#' + hex.slice(0, 6).toLowerCase();
      }

      return null;
    }

    function parsePxValue(raw: string): number {
      if (!raw || raw === 'normal' || raw === 'auto' || raw === 'none') return 0;
      const match = raw.match(/([\d.]+)\s*px/);
      if (match) return parseFloat(match[1]);
      // rem — assume 16px base
      const remMatch = raw.match(/([\d.]+)\s*rem/);
      if (remMatch) return parseFloat(remMatch[1]) * 16;
      const emMatch = raw.match(/([\d.]+)\s*em/);
      if (emMatch) return parseFloat(emMatch[1]) * 16;
      const num = parseFloat(raw);
      return isNaN(num) ? 0 : num;
    }

    function extractColorsFromShadow(shadow: string): string[] {
      const colors: string[] = [];
      const rgbaRe = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+)?\s*\)/g;
      let m: RegExpExecArray | null;
      while ((m = rgbaRe.exec(shadow)) !== null) {
        const hex = parseColor(m[0]);
        if (hex) colors.push(hex);
      }
      return colors;
    }

    // ── Collection maps ──────────────────────────────────────────

    const colorMap = new Map<string, { occurrences: number; properties: Set<string> }>();
    const typoMap = new Map<
      string,
      {
        fontFamily: string;
        fontSize: string;
        fontWeight: string;
        lineHeight: string;
        letterSpacing: string;
        occurrences: number;
        elements: Set<string>;
      }
    >();
    const spacingMap = new Map<string, { normalizedPx: number; occurrences: number; properties: Set<string> }>();
    const shadowSet = new Map<string, number>();
    const borderSet = new Map<string, number>();
    const radiusMap = new Map<string, { normalizedPx: number; occurrences: number }>();
    const zIndexMap = new Map<number, number>();

    function addColor(hex: string, property: string) {
      const entry = colorMap.get(hex);
      if (entry) {
        entry.occurrences++;
        entry.properties.add(property);
      } else {
        colorMap.set(hex, { occurrences: 1, properties: new Set([property]) });
      }
    }

    function addSpacing(value: string, normalizedPx: number, property: string) {
      if (normalizedPx === 0) return;
      const key = `${normalizedPx}px`;
      const entry = spacingMap.get(key);
      if (entry) {
        entry.occurrences++;
        entry.properties.add(property);
      } else {
        spacingMap.set(key, { normalizedPx, occurrences: 1, properties: new Set([property]) });
      }
    }

    // ── Iterate all elements ─────────────────────────────────────

    const elements = Array.from(document.querySelectorAll('*'));

    for (const el of elements) {
      const cs = getComputedStyle(el);
      const tag = el.tagName.toLowerCase();

      // Colors
      const colorProps: [string, string][] = [
        ['color', cs.color],
        ['backgroundColor', cs.backgroundColor],
        ['borderColor', cs.borderColor],
        ['outlineColor', cs.outlineColor],
      ];

      for (const [prop, val] of colorProps) {
        const hex = parseColor(val);
        if (hex) addColor(hex, prop);
      }

      // Colors from box-shadow
      if (cs.boxShadow && cs.boxShadow !== 'none') {
        for (const hex of extractColorsFromShadow(cs.boxShadow)) {
          addColor(hex, 'boxShadow');
        }
      }

      // Typography
      const typoKey = `${cs.fontFamily}|${cs.fontSize}|${cs.fontWeight}|${cs.lineHeight}|${cs.letterSpacing}`;
      const typoEntry = typoMap.get(typoKey);
      if (typoEntry) {
        typoEntry.occurrences++;
        typoEntry.elements.add(tag);
      } else {
        typoMap.set(typoKey, {
          fontFamily: cs.fontFamily,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          lineHeight: cs.lineHeight,
          letterSpacing: cs.letterSpacing,
          occurrences: 1,
          elements: new Set([tag]),
        });
      }

      // Spacing — margins
      for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
        const mVal = cs.getPropertyValue(`margin-${side.toLowerCase()}`);
        const mPx = parsePxValue(mVal);
        addSpacing(mVal, mPx, 'margin');

        const pVal = cs.getPropertyValue(`padding-${side.toLowerCase()}`);
        const pPx = parsePxValue(pVal);
        addSpacing(pVal, pPx, 'padding');
      }

      // Gap
      const gap = cs.gap || cs.getPropertyValue('gap');
      if (gap && gap !== 'normal' && gap !== '0px') {
        const gapPx = parsePxValue(gap);
        addSpacing(gap, gapPx, 'gap');
      }

      // Shadows
      if (cs.boxShadow && cs.boxShadow !== 'none') {
        const count = shadowSet.get(cs.boxShadow) || 0;
        shadowSet.set(cs.boxShadow, count + 1);
      }
      if (cs.textShadow && cs.textShadow !== 'none') {
        const count = shadowSet.get(cs.textShadow) || 0;
        shadowSet.set(cs.textShadow, count + 1);
      }

      // Borders
      const border = cs.border;
      if (border && border !== 'none' && !border.startsWith('0px')) {
        const count = borderSet.get(border) || 0;
        borderSet.set(border, count + 1);
      }

      // Border radius
      const br = cs.borderRadius;
      if (br && br !== '0px') {
        const brPx = parsePxValue(br);
        if (brPx > 0) {
          const entry = radiusMap.get(br);
          if (entry) {
            entry.occurrences++;
          } else {
            radiusMap.set(br, { normalizedPx: brPx, occurrences: 1 });
          }
        }
      }

      // Z-index
      const z = cs.zIndex;
      if (z && z !== 'auto') {
        const zVal = parseInt(z, 10);
        if (!isNaN(zVal)) {
          zIndexMap.set(zVal, (zIndexMap.get(zVal) || 0) + 1);
        }
      }
    }

    // ── Breakpoints from stylesheets ─────────────────────────────

    const breakpointSet = new Set<string>();

    try {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          const rules = Array.from(sheet.cssRules || sheet.rules || []);
          for (const rule of rules) {
            if (rule instanceof CSSMediaRule) {
              const text = rule.conditionText || rule.media.mediaText;
              const minMatch = text.match(/min-width:\s*([\d.]+(?:px|em|rem))/g);
              const maxMatch = text.match(/max-width:\s*([\d.]+(?:px|em|rem))/g);

              if (minMatch) {
                for (const m of minMatch) {
                  const val = m.replace('min-width:', '').trim();
                  breakpointSet.add(val);
                }
              }
              if (maxMatch) {
                for (const m of maxMatch) {
                  const val = m.replace('max-width:', '').trim();
                  breakpointSet.add(val);
                }
              }
            }
          }
        } catch {
          // Cross-origin stylesheet — skip
        }
      }
    } catch {
      // No stylesheets accessible
    }

    // ── Build result arrays ──────────────────────────────────────

    const colors = Array.from(colorMap.entries())
      .map(([hex, data]) => ({
        value: hex,
        hex,
        occurrences: data.occurrences,
        properties: Array.from(data.properties),
      }))
      .sort((a, b) => b.occurrences - a.occurrences);

    const typography = Array.from(typoMap.values())
      .map((t) => ({
        fontFamily: t.fontFamily,
        fontSize: t.fontSize,
        fontWeight: t.fontWeight,
        lineHeight: t.lineHeight,
        letterSpacing: t.letterSpacing,
        occurrences: t.occurrences,
        elements: Array.from(t.elements),
      }))
      .sort((a, b) => b.occurrences - a.occurrences);

    const spacing = Array.from(spacingMap.entries())
      .map(([, data]) => ({
        value: `${data.normalizedPx}px`,
        normalizedPx: data.normalizedPx,
        occurrences: data.occurrences,
        properties: Array.from(data.properties),
      }))
      .sort((a, b) => b.occurrences - a.occurrences);

    const shadows = Array.from(shadowSet.entries())
      .map(([value, occurrences]) => ({ value, occurrences }))
      .sort((a, b) => b.occurrences - a.occurrences);

    const borders = Array.from(borderSet.entries())
      .map(([value, occurrences]) => ({ value, occurrences }))
      .sort((a, b) => b.occurrences - a.occurrences);

    const radii = Array.from(radiusMap.entries())
      .map(([value, data]) => ({
        value,
        normalizedPx: data.normalizedPx,
        occurrences: data.occurrences,
      }))
      .sort((a, b) => b.occurrences - a.occurrences);

    const breakpoints = Array.from(breakpointSet).sort((a, b) => {
      return parseFloat(a) - parseFloat(b);
    });

    const zIndices = Array.from(zIndexMap.entries())
      .map(([value, occurrences]) => ({ value, occurrences }))
      .sort((a, b) => b.occurrences - a.occurrences);

    return {
      colors,
      typography,
      spacing,
      shadows,
      borders,
      radii,
      breakpoints,
      zIndices,
    };
  });
}
