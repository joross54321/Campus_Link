import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const config = readJson('firebase-applet-config.json');
const firebaserc = readJson('.firebaserc');
const firebaseJson = readJson('firebase.json');

console.log('\n=== CampusLink Firebase setup check ===\n');

let ok = true;

if (!config) {
  console.log('FAIL  firebase-applet-config.json missing');
  ok = false;
} else {
  const required = ['apiKey', 'authDomain', 'projectId', 'appId', 'firestoreDatabaseId'];
  for (const k of required) {
    if (!config[k]) {
      console.log(`FAIL  firebase-applet-config.json missing "${k}"`);
      ok = false;
    }
  }
  if (ok) {
    console.log('OK    firebase-applet-config.json');
    console.log(`      projectId: ${config.projectId}`);
    console.log(`      firestoreDatabaseId: ${config.firestoreDatabaseId}`);
    console.log(`      authDomain: ${config.authDomain}`);
  }
}

if (!firebaserc?.projects?.default) {
  console.log('FAIL  .firebaserc missing default project');
  ok = false;
} else if (config && firebaserc.projects.default !== config.projectId) {
  console.log(
    `WARN  .firebaserc project (${firebaserc.projects.default}) != config projectId (${config.projectId})`
  );
} else {
  console.log('OK    .firebaserc matches projectId');
}

if (!firebaseJson?.hosting?.public) {
  console.log('FAIL  firebase.json hosting not configured');
  ok = false;
} else {
  console.log('OK    firebase.json (hosting, firestore, functions)');
}

const dbRules = fs.existsSync(path.join(root, 'firestore.rules'));
console.log(dbRules ? 'OK    firestore.rules present' : 'FAIL  firestore.rules missing');

const dist = fs.existsSync(path.join(root, 'dist', 'index.html'));
console.log(
  dist
    ? 'OK    dist/ build exists (run npm run build before deploy)'
    : 'INFO  dist/ not built yet — run: npm run build'
);

console.log('\n--- Your one-time checklist ---');
console.log('1. Colleague adds you to Firebase project in Console');
console.log('2. Console: Authentication → Email/Password ON');
console.log('3. Console: Firestore database exists:', config?.firestoreDatabaseId ?? '?');
console.log('4. firebase login && firebase deploy --only firestore:rules,hosting,functions');
console.log('5. npm run dev → Login → Initialize → REG-2026-001 / Admin');
console.log('\nDetails: FIREBASE-SETUP.md\n');

process.exit(ok ? 0 : 1);
