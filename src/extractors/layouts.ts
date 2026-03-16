import type { Page } from 'playwright';
import type { LayoutInfo, LayoutNode } from '../types.js';

export async function analyzeLayouts(
  page: Page,
): Promise<{ layouts: LayoutInfo[]; structure: LayoutNode }> {
  const result = await page.evaluate(() => {
    const MAX_DEPTH = 5;
    const layoutContainers: {
      type: 'grid' | 'flex' | 'block' | 'float' | 'position';
      selector: string;
      properties: Record<string, string>;
      children: number;
    }[] = [];

    const layoutMap = new Map<
      string,
      { type: 'grid' | 'flex' | 'block' | 'float' | 'position'; properties: Record<string, string>; children: number; count: number }
    >();

    const getSelector = (el: Element): string => {
      if (el.id) return `#${el.id}`;
      const classes = Array.from(el.classList).filter(c => c.length > 0);
      const tag = el.tagName.toLowerCase();
      if (classes.length > 0) return `${tag}.${classes.join('.')}`;
      return tag;
    };

    const getLayoutType = (cs: CSSStyleDeclaration): 'grid' | 'flex' | 'block' | 'float' | 'position' | null => {
      const display = cs.display;
      if (display === 'grid' || display === 'inline-grid') return 'grid';
      if (display === 'flex' || display === 'inline-flex') return 'flex';
      if (cs.cssFloat !== 'none') return 'float';
      if (cs.position === 'absolute' || cs.position === 'fixed') return 'position';
      return null;
    };

    const getLayoutProperties = (
      cs: CSSStyleDeclaration,
      type: 'grid' | 'flex' | 'block' | 'float' | 'position',
    ): Record<string, string> => {
      const props: Record<string, string> = { display: cs.display };

      if (type === 'flex') {
        props['flex-direction'] = cs.flexDirection;
        props['flex-wrap'] = cs.flexWrap;
        props['justify-content'] = cs.justifyContent;
        props['align-items'] = cs.alignItems;
        props['gap'] = cs.gap;
      } else if (type === 'grid') {
        props['grid-template-columns'] = cs.gridTemplateColumns;
        props['grid-template-rows'] = cs.gridTemplateRows;
        props['gap'] = cs.gap;
        props['grid-auto-flow'] = cs.gridAutoFlow;
      } else if (type === 'float') {
        props['float'] = cs.cssFloat;
      } else if (type === 'position') {
        props['position'] = cs.position;
        props['top'] = cs.top;
        props['left'] = cs.left;
        props['right'] = cs.right;
        props['bottom'] = cs.bottom;
      }

      // Filter out default/empty values
      const filtered: Record<string, string> = {};
      for (const [k, v] of Object.entries(props)) {
        if (v && v !== 'normal' && v !== 'auto' && v !== 'none' && v !== '') {
          filtered[k] = v;
        }
      }
      return filtered;
    };

    // Find all flex/grid containers
    const structuralTags = new Set([
      'header', 'main', 'aside', 'footer', 'section', 'article', 'nav', 'div',
    ]);

    document.querySelectorAll('*').forEach(el => {
      const cs = window.getComputedStyle(el);
      const type = getLayoutType(cs);
      if (!type) return;

      const selector = getSelector(el);
      const properties = getLayoutProperties(cs, type);
      const children = el.children.length;
      const key = `${type}|${JSON.stringify(properties)}`;

      if (layoutMap.has(key)) {
        layoutMap.get(key)!.count += 1;
      } else {
        layoutMap.set(key, { type, properties, children, count: 1 });
      }
    });

    const layouts = Array.from(layoutMap.entries()).map(([_key, val]) => ({
      type: val.type,
      selector: '',
      properties: val.properties,
      children: val.children,
      occurrences: val.count,
    }));

    // Also collect per-element layout entries for structural elements
    const structuralLayouts: typeof layoutContainers = [];
    document.querySelectorAll('*').forEach(el => {
      const tag = el.tagName.toLowerCase();
      const cs = window.getComputedStyle(el);
      const type = getLayoutType(cs);
      if (!type) return;
      if (!structuralTags.has(tag)) return;

      structuralLayouts.push({
        type,
        selector: getSelector(el),
        properties: getLayoutProperties(cs, type),
        children: el.children.length,
      });
    });

    // Merge structural layouts into the layouts list with selectors
    for (const sl of structuralLayouts) {
      const existing = layouts.find(
        l => l.type === sl.type && JSON.stringify(l.properties) === JSON.stringify(sl.properties),
      );
      if (existing && !existing.selector) {
        existing.selector = sl.selector;
      }
    }

    // Assign selectors to any entries still missing one
    for (const l of layouts) {
      if (!l.selector) {
        l.selector = `[${l.type}-container]`;
      }
    }

    // Build simplified DOM tree
    const buildTree = (el: Element, depth: number): any => {
      if (depth > MAX_DEPTH) return null;

      const tag = el.tagName.toLowerCase();
      const cs = window.getComputedStyle(el);
      const display = cs.display;
      const isStructural = structuralTags.has(tag);
      const isLayout = display === 'flex' || display === 'inline-flex' || display === 'grid' || display === 'inline-grid';

      if (!isStructural && !isLayout) return null;

      const role = el.getAttribute('role') || undefined;
      const treeNode = {
        tag,
        role,
        selector: getSelector(el),
        display,
        children: [] as any[],
        componentType: undefined as string | undefined,
      };

      for (const child of Array.from(el.children)) {
        const childNode = buildTree(child, depth + 1);
        if (childNode) {
          treeNode.children.push(childNode);
        }
      }

      return treeNode;
    };

    // Start from body
    const body = document.body;
    const rootChildren: any[] = [];
    for (const child of Array.from(body.children)) {
      const node = buildTree(child, 1);
      if (node) {
        rootChildren.push(node);
      }
    }

    const structure = {
      tag: 'body',
      role: undefined as string | undefined,
      selector: 'body',
      display: window.getComputedStyle(body).display,
      children: rootChildren,
      componentType: undefined as string | undefined,
    };

    return { layouts, structure };
  });

  return {
    layouts: result.layouts as LayoutInfo[],
    structure: result.structure as LayoutNode,
  };
}
