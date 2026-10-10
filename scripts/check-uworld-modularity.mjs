import fs from 'node:fs';
import path from 'node:path';

const folder = 'src/features/exam/themes/uworld';
const files = fs.readdirSync(folder, { withFileTypes: true });
const all = [];
for (const entry of files) {
  if (entry.isFile()) all.push(path.join(folder, entry.name));
  if (entry.isDirectory() && entry.name === 'styles') {
    for (const child of fs.readdirSync(path.join(folder, entry.name))) {
      all.push(path.join(folder, entry.name, child));
    }
  }
}
const required = [
  'UWorldTheme.tsx', 'UWorldTopbar.tsx', 'UWorldSidebar.tsx',
  'UWorldQuestionPane.tsx', 'UWorldOptions.tsx',
  'UWorldExplanationPane.tsx', 'UWorldSettings.tsx',
  'UWorldBottomBar.tsx', 'useUWorldPreferences.ts',
];
const errors = [];
for (const file of required) {
  if (!fs.existsSync(path.join(folder, file))) errors.push('Missing component: ' + file);
}
for (const file of all) {
  if (!fs.statSync(file).isFile()) continue;
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n').length;
  const limit = file.endsWith('.css') ? 300 : file.endsWith('.tsx') ? 200 : 160;
  if (lines > limit) errors.push(file + ' has ' + lines + ' lines, limit is ' + limit);
  if (content.length > 18000) errors.push(file + ' exceeds the 18k-character single-responsibility budget');
  if (/useMutation\s*\(|axios\.|fetch\s*\(|dangerouslySetInnerHTML/.test(content)) {
    errors.push(file + ' bypasses shared controller/API or HTML sanitizer boundary');
  }
}
const core = fs.readFileSync('src/features/exam/core/useExamRunner.ts', 'utf8');
if (core.includes('UWorldTheme') || core.includes('uworld-')) {
  errors.push('UWorld presentation may not be coupled back into shared Exam Core');
}
if (errors.length) {
  console.error('UWorld architecture violations:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('UWorld modularity verified: ' + all.length + ' focused files, controller boundary preserved.');
