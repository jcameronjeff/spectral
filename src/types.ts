// ── Design Tokens ──────────────────────────────────────────────

export interface ColorToken {
  value: string;          // hex, rgb, hsl
  hex: string;            // normalized hex
  occurrences: number;    // how many times used
  properties: string[];   // which CSS properties use it (background, color, border, etc.)
  name?: string;          // auto-generated semantic name
}

export interface TypographyToken {
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
  occurrences: number;
  elements: string[];     // which elements use this style (h1, p, .btn, etc.)
}

export interface SpacingToken {
  value: string;          // px, rem, em
  normalizedPx: number;   // converted to px for comparison
  occurrences: number;
  properties: string[];   // margin, padding, gap
}

export interface ShadowToken {
  value: string;
  occurrences: number;
}

export interface BorderToken {
  value: string;
  occurrences: number;
}

export interface RadiusToken {
  value: string;
  normalizedPx: number;
  occurrences: number;
}

export interface DesignTokens {
  colors: ColorToken[];
  typography: TypographyToken[];
  spacing: SpacingToken[];
  shadows: ShadowToken[];
  borders: BorderToken[];
  radii: RadiusToken[];
  breakpoints: string[];
  zIndices: { value: number; occurrences: number }[];
}

// ── Components ─────────────────────────────────────────────────

export interface DetectedComponent {
  type: ComponentType;
  selector: string;       // CSS selector to find it
  count: number;          // instances found
  variants: ComponentVariant[];
  sample: {
    html: string;         // trimmed outer HTML of first instance
    styles: Record<string, string>;
  };
  pages: string[];        // URLs where found
}

export type ComponentType =
  | 'button'
  | 'card'
  | 'nav'
  | 'header'
  | 'footer'
  | 'modal'
  | 'form'
  | 'input'
  | 'dropdown'
  | 'tabs'
  | 'accordion'
  | 'carousel'
  | 'badge'
  | 'avatar'
  | 'toast'
  | 'table'
  | 'list'
  | 'hero'
  | 'sidebar'
  | 'breadcrumb'
  | 'pagination'
  | 'icon'
  | 'image'
  | 'video'
  | 'custom';

export interface ComponentVariant {
  name: string;
  selector: string;
  count: number;
  differingStyles: Record<string, string>;
}

// ── Layouts ────────────────────────────────────────────────────

export interface LayoutInfo {
  type: 'grid' | 'flex' | 'block' | 'float' | 'position';
  selector: string;
  properties: Record<string, string>;
  children: number;
  occurrences: number;
}

export interface PageLayout {
  url: string;
  title: string;
  structure: LayoutNode;
  layouts: LayoutInfo[];
}

export interface LayoutNode {
  tag: string;
  role?: string;
  selector: string;
  display: string;
  children: LayoutNode[];
  componentType?: ComponentType;
}

// ── Sitemap ────────────────────────────────────────────────────

export interface SitemapPage {
  url: string;
  title: string;
  depth: number;
  status: number;
  components: { type: ComponentType; count: number }[];
  layout: LayoutNode;
  screenshot?: string;    // base64 thumbnail
}

export interface Sitemap {
  baseUrl: string;
  pages: SitemapPage[];
  crawledAt: string;
}

// ── Full Report ────────────────────────────────────────────────

export interface SpectralReport {
  url: string;
  analyzedAt: string;
  tokens: DesignTokens;
  components: DetectedComponent[];
  layouts: PageLayout[];
  sitemap: Sitemap;
  meta: {
    pagesAnalyzed: number;
    totalComponents: number;
    totalTokens: number;
    duration: number;
  };
}

// ── Config ─────────────────────────────────────────────────────

export interface SpectralConfig {
  url: string;
  maxPages: number;
  depth: number;
  includeSitemap: boolean;
  includeScreenshots: boolean;
  outputFormat: 'json' | 'markdown' | 'both';
  outputDir: string;
  headless: boolean;
  timeout: number;
}

export const DEFAULT_CONFIG: Omit<SpectralConfig, 'url'> = {
  maxPages: 20,
  depth: 3,
  includeSitemap: true,
  includeScreenshots: false,
  outputFormat: 'both',
  outputDir: './spectral-output',
  headless: true,
  timeout: 30000,
};
