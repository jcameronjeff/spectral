import type { Page } from 'playwright';
import type { DetectedComponent, ComponentType, ComponentVariant } from '../types.js';

interface RawComponent {
  type: ComponentType;
  selector: string;
  count: number;
  html: string;
  styles: Record<string, string>;
  variantGroups: { selector: string; styles: Record<string, string> }[];
}

export async function detectComponents(page: Page): Promise<DetectedComponent[]> {
  const url = page.url();

  const raw = await page.evaluate(() => {
    const results: {
      type: string;
      selector: string;
      count: number;
      html: string;
      styles: Record<string, string>;
      variantGroups: { selector: string; styles: Record<string, string> }[];
    }[] = [];

    function getSelector(el: Element): string {
      if (el.id) return `#${el.id}`;
      const classes = Array.from(el.classList).filter(c => c.length > 0);
      if (classes.length > 0) {
        const tag = el.tagName.toLowerCase();
        return `${tag}.${classes.join('.')}`;
      }
      return el.tagName.toLowerCase();
    }

    function getKeyStyles(el: Element, props: string[]): Record<string, string> {
      const cs = window.getComputedStyle(el);
      const out: Record<string, string> = {};
      for (const p of props) {
        const v = cs.getPropertyValue(p);
        if (v && v !== 'none' && v !== 'normal' && v !== 'auto') {
          out[p] = v;
        }
      }
      return out;
    }

    function trimHTML(el: Element): string {
      return el.outerHTML.substring(0, 500);
    }

    function detectVariants(
      elements: Element[],
      differProps: string[],
    ): { selector: string; styles: Record<string, string> }[] {
      const groups = new Map<string, { selector: string; styles: Record<string, string>; count: number }>();
      for (const el of elements) {
        const cs = window.getComputedStyle(el);
        const key = differProps.map(p => cs.getPropertyValue(p)).join('|');
        if (!groups.has(key)) {
          const styles: Record<string, string> = {};
          for (const p of differProps) {
            styles[p] = cs.getPropertyValue(p);
          }
          groups.set(key, { selector: getSelector(el), styles, count: 1 });
        } else {
          groups.get(key)!.count += 1;
        }
      }
      return Array.from(groups.values()).map(g => ({
        selector: g.selector,
        styles: g.styles,
      }));
    }

    function addResult(
      type: string,
      elements: Element[],
      styleProps: string[],
      variantProps: string[],
    ) {
      if (elements.length === 0) return;
      const first = elements[0];
      results.push({
        type,
        selector: getSelector(first),
        count: elements.length,
        html: trimHTML(first),
        styles: getKeyStyles(first, styleProps),
        variantGroups: detectVariants(elements, variantProps),
      });
    }

    // ── Buttons ──
    const buttons: Element[] = [];
    document.querySelectorAll('button, [role="button"], input[type="submit"]').forEach(el => buttons.push(el));
    document.querySelectorAll('a').forEach(el => {
      const cs = window.getComputedStyle(el);
      const display = cs.display;
      const padding = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const bg = cs.backgroundColor;
      const radius = parseFloat(cs.borderRadius);
      if (
        (display === 'inline-block' || display === 'flex' || display === 'inline-flex') &&
        padding > 4 &&
        bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' &&
        radius > 0
      ) {
        buttons.push(el);
      }
    });
    addResult('button', buttons,
      ['background-color', 'color', 'border-radius', 'padding', 'font-size', 'font-weight', 'border'],
      ['background-color', 'color', 'border'],
    );

    // ── Cards ──
    const cards: Element[] = [];
    document.querySelectorAll('*').forEach(el => {
      const cs = window.getComputedStyle(el);
      if (
        cs.boxShadow !== 'none' &&
        parseFloat(cs.borderRadius) > 0 &&
        (parseFloat(cs.padding) > 0 || parseFloat(cs.paddingTop) > 0)
      ) {
        const hasImage = el.querySelector('img') !== null;
        const hasText = el.querySelector('p, h1, h2, h3, h4, h5, h6, span') !== null;
        if (hasImage && hasText) {
          cards.push(el);
        }
      }
    });
    addResult('card', cards,
      ['box-shadow', 'border-radius', 'padding', 'background-color'],
      ['box-shadow', 'background-color'],
    );

    // ── Navigation ──
    const navs: Element[] = [];
    document.querySelectorAll('nav, [role="navigation"]').forEach(el => navs.push(el));
    document.querySelectorAll('header').forEach(el => {
      if (el.querySelectorAll('a').length >= 2 && !navs.includes(el)) {
        navs.push(el);
      }
    });
    addResult('nav', navs,
      ['display', 'flex-direction', 'gap', 'background-color', 'padding'],
      ['background-color'],
    );

    // ── Header ──
    const headers: Element[] = [];
    document.querySelectorAll('header, [role="banner"]').forEach(el => headers.push(el));
    addResult('header', headers,
      ['display', 'position', 'background-color', 'padding', 'height'],
      ['background-color'],
    );

    // ── Footer ──
    const footers: Element[] = [];
    document.querySelectorAll('footer, [role="contentinfo"]').forEach(el => footers.push(el));
    addResult('footer', footers,
      ['display', 'background-color', 'padding', 'color'],
      ['background-color'],
    );

    // ── Modals ──
    const modals: Element[] = [];
    document.querySelectorAll('[role="dialog"], .modal').forEach(el => modals.push(el));
    document.querySelectorAll('*').forEach(el => {
      const cs = window.getComputedStyle(el);
      const pos = cs.position;
      const z = parseInt(cs.zIndex, 10);
      if (
        (pos === 'fixed' || pos === 'absolute') &&
        z > 100 &&
        !modals.includes(el)
      ) {
        const rect = el.getBoundingClientRect();
        const vw = window.innerWidth;
        const centerX = rect.left + rect.width / 2;
        if (Math.abs(centerX - vw / 2) < vw * 0.2) {
          modals.push(el);
        }
      }
    });
    addResult('modal', modals,
      ['position', 'z-index', 'background-color', 'border-radius', 'box-shadow', 'width', 'max-width'],
      ['background-color'],
    );

    // ── Forms ──
    const forms = Array.from(document.querySelectorAll('form'));
    addResult('form', forms,
      ['display', 'flex-direction', 'gap', 'padding'],
      [],
    );

    // ── Inputs ──
    const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]), textarea, select'));
    addResult('input', inputs,
      ['border', 'border-radius', 'padding', 'font-size', 'background-color', 'color', 'height'],
      ['border', 'background-color'],
    );

    // ── Dropdowns ──
    const dropdowns = Array.from(document.querySelectorAll('[role="listbox"], [role="menu"], .dropdown'));
    addResult('dropdown', dropdowns,
      ['position', 'background-color', 'border', 'border-radius', 'box-shadow', 'z-index'],
      ['background-color'],
    );

    // ── Tabs ──
    const tabs = Array.from(document.querySelectorAll('[role="tablist"]'));
    document.querySelectorAll('*').forEach(el => {
      const children = Array.from(el.children);
      if (
        children.length >= 2 &&
        children.every(c => c.getAttribute('role') === 'tab') &&
        !tabs.includes(el)
      ) {
        tabs.push(el);
      }
    });
    addResult('tabs', tabs,
      ['display', 'flex-direction', 'gap', 'border-bottom'],
      ['background-color'],
    );

    // ── Accordion ──
    const accordions: Element[] = [];
    document.querySelectorAll('details').forEach(el => accordions.push(el));
    document.querySelectorAll('[role="region"]').forEach(el => {
      const prev = el.previousElementSibling;
      if (prev && (prev.getAttribute('aria-expanded') !== null)) {
        if (!accordions.includes(el.parentElement!)) {
          accordions.push(el.parentElement!);
        }
      }
    });
    addResult('accordion', accordions,
      ['border', 'padding', 'background-color'],
      ['background-color'],
    );

    // ── Badges ──
    const badges: Element[] = [];
    document.querySelectorAll('span, div').forEach(el => {
      const cs = window.getComputedStyle(el);
      const fontSize = parseFloat(cs.fontSize);
      const bg = cs.backgroundColor;
      const radius = parseFloat(cs.borderRadius);
      const display = cs.display;
      if (
        fontSize <= 14 &&
        radius > 0 &&
        bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' &&
        (display === 'inline' || display === 'inline-block' || display === 'inline-flex') &&
        el.textContent!.trim().length > 0 &&
        el.textContent!.trim().length < 30 &&
        el.children.length <= 1
      ) {
        badges.push(el);
      }
    });
    addResult('badge', badges,
      ['background-color', 'color', 'border-radius', 'font-size', 'padding'],
      ['background-color', 'color'],
    );

    // ── Avatars ──
    const avatars: Element[] = [];
    document.querySelectorAll('img').forEach(el => {
      const cs = window.getComputedStyle(el);
      const radius = parseFloat(cs.borderRadius);
      const width = parseFloat(cs.width);
      const height = parseFloat(cs.height);
      if (radius >= width * 0.4 && width <= 120 && width > 16 && Math.abs(width - height) < 10) {
        avatars.push(el);
      }
    });
    addResult('avatar', avatars,
      ['border-radius', 'width', 'height', 'border'],
      ['width', 'height'],
    );

    // ── Tables ──
    const tables = Array.from(document.querySelectorAll('table'));
    addResult('table', tables,
      ['border-collapse', 'width', 'border'],
      [],
    );

    // ── Lists ──
    const lists: Element[] = [];
    document.querySelectorAll('ul, ol').forEach(el => {
      if (el.querySelectorAll('li').length > 0) {
        lists.push(el);
      }
    });
    addResult('list', lists,
      ['list-style-type', 'padding', 'margin'],
      ['list-style-type'],
    );

    // ── Hero ──
    const heroes: Element[] = [];
    const allSections = Array.from(document.querySelectorAll('section, div, header'));
    for (const el of allSections) {
      const rect = el.getBoundingClientRect();
      if (rect.top < 200 && rect.height > 300) {
        const bigText = el.querySelector('h1, h2');
        if (bigText) {
          const cs = window.getComputedStyle(el);
          const bg = cs.backgroundImage;
          const bgColor = cs.backgroundColor;
          if (bg !== 'none' || bgColor !== 'rgba(0, 0, 0, 0)') {
            heroes.push(el);
            break;
          }
        }
      }
    }
    addResult('hero', heroes,
      ['background-image', 'background-color', 'padding', 'min-height', 'display', 'align-items', 'justify-content'],
      [],
    );

    // ── Sidebar ──
    const sidebars: Element[] = [];
    document.querySelectorAll('aside, [role="complementary"]').forEach(el => sidebars.push(el));
    addResult('sidebar', sidebars,
      ['width', 'min-width', 'max-width', 'position', 'background-color', 'padding'],
      ['background-color'],
    );

    // ── Breadcrumbs ──
    const breadcrumbs: Element[] = [];
    document.querySelectorAll('[aria-label="breadcrumb"], .breadcrumb, .breadcrumbs').forEach(el => breadcrumbs.push(el));
    document.querySelectorAll('nav').forEach(el => {
      const text = el.textContent || '';
      if ((text.includes('/') || text.includes('>') || text.includes('›')) && el.querySelectorAll('a').length >= 2) {
        if (!breadcrumbs.includes(el)) {
          breadcrumbs.push(el);
        }
      }
    });
    addResult('breadcrumb', breadcrumbs,
      ['display', 'gap', 'font-size', 'color'],
      [],
    );

    // ── Pagination ──
    const paginations: Element[] = [];
    document.querySelectorAll('.pagination').forEach(el => paginations.push(el));
    document.querySelectorAll('nav').forEach(el => {
      const links = el.querySelectorAll('a');
      const hasNumbers = Array.from(links).some(a => /^\d+$/.test(a.textContent!.trim()));
      if (hasNumbers && links.length >= 3 && !paginations.includes(el)) {
        paginations.push(el);
      }
    });
    addResult('pagination', paginations,
      ['display', 'gap', 'align-items'],
      [],
    );

    return results;
  });

  return (raw as RawComponent[])
    .filter(r => r.count > 0)
    .map(r => {
      const variants: ComponentVariant[] = r.variantGroups.map((v, i) => ({
        name: `variant-${i + 1}`,
        selector: v.selector,
        count: 1,
        differingStyles: v.styles,
      }));

      return {
        type: r.type as ComponentType,
        selector: r.selector,
        count: r.count,
        variants,
        sample: {
          html: r.html,
          styles: r.styles,
        },
        pages: [url],
      };
    });
}
