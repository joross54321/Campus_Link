import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function tokenize(fileRel) {
  const filePath = path.join(root, fileRel);
  let c = fs.readFileSync(filePath, 'utf8');
  const pairs = [
    ['text-brand-blue', 'text-primary'],
    ['bg-brand-blue', 'bg-primary'],
    ['border-brand-blue', 'border-primary'],
    ['shadow-brand-blue', 'shadow-primary'],
    ['text-brand-gold', 'text-accent'],
    ['bg-brand-gold', 'bg-accent'],
    ['border-brand-gold', 'border-accent'],
    ['shadow-brand-gold', 'shadow-accent'],
    ['text-brand-ink', 'text-foreground'],
    ['bg-brand-paper', 'bg-background'],
    ['border-slate-100', 'border-border'],
    ['border-slate-200', 'border-border'],
    ['bg-slate-50', 'bg-background'],
    ['text-slate-400', 'text-muted'],
    ['text-slate-500', 'text-muted'],
    ['text-slate-300', 'text-muted-foreground'],
    ['bg-white', 'bg-surface'],
  ];
  for (const [a, b] of pairs) {
    if (c.includes(a)) c = c.split(a).join(b);
  }
  fs.writeFileSync(filePath, c);
  console.log('Tokenized', fileRel);
}

function patchProfessorHeader(fileRel, title, subtitle, badge, backTo) {
  const filePath = path.join(root, fileRel);
  let c = fs.readFileSync(filePath, 'utf8');
  if (!c.includes('ArrowLeft size={20}')) {
    console.log('skip', fileRel);
    return;
  }
  if (!c.includes("import PageHeader")) {
    c = c.replace(
      "import { motion } from 'motion/react';",
      "import PageHeader from '../components/layout/PageHeader';\nimport { motion } from 'motion/react';"
    );
  }
  const re =
    /      <div className="flex items-center gap-6 pb-4">[\s\S]*?      <\/motion.div>\n\n      <div className="grid/;
  const reDiv =
    /      <div className="flex items-center gap-6 pb-4">[\s\S]*?      <\/div>\n\n      <motion.div className="grid/;
  const reGrid =
    /      <div className="flex items-center gap-6 pb-4">[\s\S]*?      <\/div>\n\n      <div className="grid/;
  const replacement = `      <PageHeader
        title="${title}"
        subtitle="${subtitle}"
        badge="${badge}"
        backTo="${backTo}"
      />

      <div className="grid`;
  if (reGrid.test(c)) {
    c = c.replace(reGrid, replacement);
    fs.writeFileSync(filePath, c);
    console.log('Professor header', fileRel);
  } else {
    console.log('Professor regex miss', fileRel);
  }
}

patchProfessorHeader('src/pages/ProfessorSections.tsx', 'Assigned Sections', 'Section overview', 'Legacy browse', '/professor');
patchProfessorHeader(
  'src/pages/ProfessorSectionCourses.tsx',
  'Assigned Subjects',
  'Subjects in section',
  'Legacy browse',
  '/professor/sections'
);
patchProfessorHeader(
  'src/pages/ProfessorCourseSections.tsx',
  'Course sections',
  'Section distribution',
  'Legacy browse',
  '/professor/courses'
);

[
  'src/pages/ProfessorCourses.tsx',
  'src/pages/ProfessorSections.tsx',
  'src/pages/ProfessorSectionCourses.tsx',
  'src/pages/ProfessorCourseSections.tsx',
].forEach((f) => tokenize(f));
