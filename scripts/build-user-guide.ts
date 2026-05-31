/**
 * Build Script: Markdown to HTML Conversion for User Guide
 *
 * Converts `docs/USER_GUIDE.md` into a static HTML file with an embedded
 * table of contents (TOC) and anchor links. The generated HTML is written
 * to `packages/core/src/helpButton/user-guide.html`.
 *
 * The TOC includes only H2 and H3 headings in document order, with H3
 * entries nested under their preceding H2.
 *
 * Usage: npx tsx scripts/build-user-guide.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { marked, Renderer } from 'marked';

export interface BuildConfig {
  /** Path to the source markdown file */
  inputPath: string;
  /** Path to the output HTML file */
  outputPath: string;
  /** CSS class prefix for generated elements */
  classPrefix: string;
}

export interface HeadingEntry {
  level: number;
  text: string;
  slug: string;
}

export interface GeneratedHTML {
  /** The full HTML string including TOC nav and content */
  html: string;
  /** Metadata about the generation */
  meta: {
    generatedAt: string;
    sourceHash: string;
    headingCount: number;
  };
}

/**
 * Generate a URL-friendly slug from heading text.
 * Converts to lowercase, replaces non-alphanumeric characters with hyphens,
 * collapses multiple hyphens, and trims leading/trailing hyphens.
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Build the TOC HTML from a list of heading entries.
 * H3 entries are nested under their preceding H2 in a sub-<ol>.
 */
export function buildTocHtml(headings: HeadingEntry[], classPrefix: string): string {
  if (headings.length === 0) {
    return `<nav class="${classPrefix}toc" aria-label="Table of Contents">\n  <ol>\n  </ol>\n</nav>`;
  }

  let html = `<nav class="${classPrefix}toc" aria-label="Table of Contents">\n  <ol>\n`;

  let i = 0;
  while (i < headings.length) {
    const heading = headings[i];

    if (heading.level === 2) {
      // Check if there are H3 children following this H2
      const children: HeadingEntry[] = [];
      let j = i + 1;
      while (j < headings.length && headings[j].level === 3) {
        children.push(headings[j]);
        j++;
      }

      if (children.length > 0) {
        html += `    <li><a href="#${heading.slug}" class="${classPrefix}toc-h2">${heading.text}</a>\n`;
        html += `      <ol>\n`;
        for (const child of children) {
          html += `        <li><a href="#${child.slug}" class="${classPrefix}toc-h3">${child.text}</a></li>\n`;
        }
        html += `      </ol>\n`;
        html += `    </li>\n`;
      } else {
        html += `    <li><a href="#${heading.slug}" class="${classPrefix}toc-h2">${heading.text}</a></li>\n`;
      }

      i = j;
    } else if (heading.level === 3) {
      // Orphan H3 (no preceding H2) — still include it at top level
      html += `    <li><a href="#${heading.slug}" class="${classPrefix}toc-h3">${heading.text}</a></li>\n`;
      i++;
    } else {
      i++;
    }
  }

  html += `  </ol>\n</nav>`;
  return html;
}

/**
 * Convert markdown to static HTML with TOC.
 * Runs at build time only — never at runtime.
 */
export function convertMarkdownToHTML(markdown: string, config: BuildConfig): GeneratedHTML {
  const headings: HeadingEntry[] = [];

  // Create a custom renderer that adds id attributes to H2 and H3 headings
  const renderer = new Renderer();
  renderer.heading = function ({ text, depth }: { text: string; depth: number }) {
    const slug = generateSlug(text);

    if (depth === 2 || depth === 3) {
      headings.push({ level: depth, text, slug });
      return `<h${depth} id="${slug}">${text}</h${depth}>\n`;
    }

    // For other heading levels, render without id
    return `<h${depth}>${text}</h${depth}>\n`;
  };

  // Convert markdown to HTML
  const contentHtml = marked(markdown, {
    renderer,
    gfm: true,
  }) as string;

  // Build the TOC
  const tocHtml = buildTocHtml(headings, config.classPrefix);

  // Wrap content in article element
  const articleHtml = `<article class="${config.classPrefix}content">\n${contentHtml}</article>`;

  // Combine TOC and content
  const fullHtml = `${tocHtml}\n${articleHtml}`;

  // Compute source hash
  const sourceHash = crypto.createHash('sha256').update(markdown).digest('hex').slice(0, 16);

  return {
    html: fullHtml,
    meta: {
      generatedAt: new Date().toISOString(),
      sourceHash,
      headingCount: headings.length,
    },
  };
}

function main(): void {
  const workspaceRoot = process.cwd();

  const config: BuildConfig = {
    inputPath: 'docs/USER_GUIDE.md',
    outputPath: 'packages/core/src/helpButton/user-guide.html',
    classPrefix: 'ug-',
  };

  const inputFullPath = path.join(workspaceRoot, config.inputPath);
  const outputFullPath = path.join(workspaceRoot, config.outputPath);

  // Read the source markdown
  if (!fs.existsSync(inputFullPath)) {
    console.error(`Error: Source file not found: ${inputFullPath}`);
    process.exit(1);
  }

  const markdown = fs.readFileSync(inputFullPath, 'utf-8');

  console.log(`Converting ${config.inputPath} to HTML...`);

  // Convert
  const result = convertMarkdownToHTML(markdown, config);

  // Ensure output directory exists
  const outputDir = path.dirname(outputFullPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write output
  fs.writeFileSync(outputFullPath, result.html, 'utf-8');

  console.log(`✓ Generated ${config.outputPath}`);
  console.log(`  Headings: ${result.meta.headingCount}`);
  console.log(`  Source hash: ${result.meta.sourceHash}`);
  console.log(`  Generated at: ${result.meta.generatedAt}`);
}

// Run main only when executed directly
const isDirectExecution = process.argv[1]?.includes('build-user-guide');
if (isDirectExecution) {
  main();
}
