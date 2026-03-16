---
name: spectral
description: Reverse-engineer a website's design system — extract tokens, components, layouts, and sitemap
user_invocable: true
arguments:
  - name: url
    description: The URL to analyze
    required: true
---

# Spectral — Design System Scanner

When the user invokes /spectral with a URL, run the spectral CLI to analyze that website's design system.

## Steps:
1. cd to the spectral project directory
2. Run: `npx tsx src/cli.ts {url}`
3. Read and present the generated DESIGN-SYSTEM.md report to the user
4. Highlight the most interesting findings (color palette, component library, typography scale)
