#!/usr/bin/env node
/**
 * Portable SKILL.md generator.
 *
 * Pipeline:
 *   walk each skill dir for SKILL.md.tmpl → replace {{PLACEHOLDERS}} → write SKILL.md
 *
 * Placeholders are resolved by reading _templates/<NAME>.md, so you can
 * customize the shared preamble by editing those files — no code changes.
 *
 * Usage:
 *   node scripts/gen-skill-docs.mjs           # regenerate all SKILL.md files
 *   node scripts/gen-skill-docs.mjs --dry-run # exit 1 if any are stale (for CI)
 *
 * Zero dependencies. Works with Node 18+ or Bun. No compilation step.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const TEMPLATES_DIR = path.join(ROOT, '_templates');
const DRY_RUN = process.argv.includes('--dry-run');

const GENERATED_HEADER =
  `<!-- AUTO-GENERATED from {{SOURCE}} — do not edit directly -->\n` +
  `<!-- Regenerate: node scripts/gen-skill-docs.mjs -->\n`;

// ─── Placeholder resolvers ──────────────────────────────────
// Each resolver takes a TemplateContext and returns a string.
// The default resolver loads _templates/<NAME>.md and returns its content.

/** @typedef {{ tmplPath: string, skillName: string }} TemplateContext */

/** @type {Record<string, (ctx: TemplateContext) => string>} */
const RESOLVERS = {
  PREAMBLE: () => loadTemplateFragment('PREAMBLE'),
  BASE_BRANCH_DETECT: () => loadTemplateFragment('BASE_BRANCH_DETECT'),
};

function loadTemplateFragment(name) {
  const fragmentPath = path.join(TEMPLATES_DIR, `${name}.md`);
  if (!fs.existsSync(fragmentPath)) {
    throw new Error(
      `Template fragment not found: _templates/${name}.md\n` +
      `Either create the file or remove {{${name}}} from your .tmpl files.`
    );
  }
  // Trim trailing newline so we don't accumulate blank lines on replacement
  return fs.readFileSync(fragmentPath, 'utf-8').replace(/\n+$/, '');
}

// ─── Template processor ────────────────────────────────────

function processTemplate(tmplPath) {
  const tmplContent = fs.readFileSync(tmplPath, 'utf-8');
  const outputPath = tmplPath.replace(/\.tmpl$/, '');

  // Extract skill name from frontmatter for TemplateContext
  const nameMatch = tmplContent.match(/^name:\s*(.+)$/m);
  const skillName = nameMatch
    ? nameMatch[1].trim()
    : path.basename(path.dirname(tmplPath));

  const ctx = { tmplPath, skillName };

  // Replace {{PLACEHOLDERS}}
  let content = tmplContent.replace(/\{\{(\w+)\}\}/g, (match, name) => {
    const resolver = RESOLVERS[name];
    if (!resolver) {
      throw new Error(
        `Unknown placeholder {{${name}}} in ${path.relative(ROOT, tmplPath)}\n` +
        `Known placeholders: ${Object.keys(RESOLVERS).join(', ')}`
      );
    }
    return resolver(ctx);
  });

  // Check for unresolved placeholders
  const remaining = content.match(/\{\{(\w+)\}\}/g);
  if (remaining) {
    throw new Error(
      `Unresolved placeholders in ${path.relative(ROOT, tmplPath)}: ${remaining.join(', ')}`
    );
  }

  // Prepend generated header (after YAML frontmatter if present)
  const header = GENERATED_HEADER.replace('{{SOURCE}}', path.basename(tmplPath));
  const fmStart = content.indexOf('---');
  if (fmStart === 0) {
    const fmEnd = content.indexOf('---', 3);
    if (fmEnd !== -1) {
      const insertAt = content.indexOf('\n', fmEnd) + 1;
      content = content.slice(0, insertAt) + header + content.slice(insertAt);
    } else {
      content = header + content;
    }
  } else {
    content = header + content;
  }

  return { outputPath, content };
}

// ─── Template discovery ────────────────────────────────────

function findTemplates() {
  const templates = [];
  const rootTmpl = path.join(ROOT, 'SKILL.md.tmpl');
  if (fs.existsSync(rootTmpl)) templates.push(rootTmpl);

  for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
    if (entry.name === 'node_modules' || entry.name === 'scripts') continue;
    const tmpl = path.join(ROOT, entry.name, 'SKILL.md.tmpl');
    if (fs.existsSync(tmpl)) templates.push(tmpl);
  }
  return templates;
}

// ─── Main ──────────────────────────────────────────────────

const templates = findTemplates();
if (templates.length === 0) {
  console.error('No SKILL.md.tmpl files found. Looked in:', ROOT);
  process.exit(1);
}

let hasChanges = false;
let errors = 0;

for (const tmplPath of templates) {
  try {
    const { outputPath, content } = processTemplate(tmplPath);
    const relOutput = path.relative(ROOT, outputPath);

    if (DRY_RUN) {
      const existing = fs.existsSync(outputPath)
        ? fs.readFileSync(outputPath, 'utf-8')
        : '';
      if (existing !== content) {
        console.log(`STALE:     ${relOutput}`);
        hasChanges = true;
      } else {
        console.log(`FRESH:     ${relOutput}`);
      }
    } else {
      fs.writeFileSync(outputPath, content);
      console.log(`GENERATED: ${relOutput}`);
    }
  } catch (err) {
    console.error(`ERROR in ${path.relative(ROOT, tmplPath)}:`);
    console.error(`  ${err.message}`);
    errors++;
  }
}

if (errors > 0) {
  console.error(`\n${errors} template(s) failed.`);
  process.exit(1);
}

if (DRY_RUN && hasChanges) {
  console.error('\nGenerated SKILL.md files are stale.');
  console.error('Run: node scripts/gen-skill-docs.mjs');
  process.exit(1);
}
