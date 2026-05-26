import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const filePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/pages/EnrollmentWizard.tsx'
);
let lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

const motionCloseLines = [325, 463, 519, 622, 628, 667];
const badClose = String.fromCharCode(60, 47, 100, 105, 118, 62); // </div>
const goodClose = String.fromCharCode(60, 47, 109, 111, 116, 105, 111, 110, 46, 100, 105, 118, 62); // </motion.div>

for (const lineNum of motionCloseLines) {
  const i = lineNum - 1;
  if (lines[i]?.includes(badClose)) {
    lines[i] = lines[i].replace(badClose, goodClose);
    console.log('fixed line', lineNum);
  } else {
    console.log('no bad close on line', lineNum, lines[i]?.trim());
  }
}

fs.writeFileSync(filePath, lines.join('\n'));
console.log('done');
