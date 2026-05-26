/**
 * Bulk-delete CampusLink Firestore data (and optionally all Auth users).
 *
 * Prerequisites:
 *   1. npm install  (firebase-admin is a devDependency)
 *   2. Credentials — pick one:
 *      - Service account: Firebase Console → Project settings → Service accounts
 *        → Generate new private key → set env:
 *          set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\key.json
 *      - Or: gcloud auth application-default login --project YOUR_PROJECT_ID
 *
 * Usage:
 *   node scripts/clear-database.mjs --dry-run
 *   node scripts/clear-database.mjs --confirm
 *   node scripts/clear-database.mjs --confirm --auth
 *
 * After a full clear, run Initialize on the login page (or npm run dev → Initialize).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const COLLECTIONS = [
  'enrollments',
  'grades',
  'subjects',
  'users',
  'notifications',
  'admin_logs',
];

const BATCH_SIZE = 400;

function loadProjectConfig() {
  const configPath = path.join(root, 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('Missing firebase-applet-config.json at project root.');
  }
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const projectId = cfg.projectId;
  const databaseId = cfg.firestoreDatabaseId;
  if (!projectId || !databaseId) {
    throw new Error('firebase-applet-config.json needs projectId and firestoreDatabaseId.');
  }
  return { projectId, databaseId };
}

function parseArgs(argv) {
  const dryRun = argv.includes('--dry-run');
  const confirm = argv.includes('--confirm');
  const withAuth = argv.includes('--auth');
  if (!dryRun && !confirm) {
    console.error(
      'Pass --dry-run to preview, or --confirm to delete.\n' +
        'Add --auth to also delete every Firebase Authentication user.\n' +
        'Example: node scripts/clear-database.mjs --confirm --auth'
    );
    process.exit(1);
  }
  return { dryRun, confirm, withAuth };
}

function initAdmin(projectId) {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    return initializeApp({
      credential: cert(key),
      projectId: key.project_id ?? projectId,
    });
  }
  return initializeApp({
    credential: applicationDefault(),
    projectId,
  });
}

async function countCollection(db, name) {
  const snap = await db.collection(name).count().get();
  return snap.data().count;
}

async function deleteCollection(db, name, dryRun) {
  let total = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await db.collection(name).limit(BATCH_SIZE).get();
    if (snap.empty) break;
    total += snap.size;
    if (dryRun) continue;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    process.stdout.write(`  ${name}: deleted ${total} docs...\r`);
  }
  if (!dryRun && total > 0) {
    console.log(`  ${name}: deleted ${total} document(s).`);
  }
  return total;
}

async function deleteSystemConfig(db, dryRun) {
  const ref = db.collection('system').doc('config');
  const snap = await ref.get();
  if (!snap.exists) return 0;
  if (!dryRun) await ref.delete();
  return 1;
}

async function deleteAllAuthUsers(dryRun) {
  const auth = getAuth();
  let total = 0;
  let pageToken;
  do {
    const result = await auth.listUsers(1000, pageToken);
    for (const user of result.users) {
      total += 1;
      if (!dryRun) await auth.deleteUser(user.uid);
    }
    pageToken = result.pageToken;
    if (!dryRun && total > 0) {
      process.stdout.write(`  auth: deleted ${total} users...\r`);
    }
  } while (pageToken);
  if (!dryRun && total > 0) {
    console.log(`  auth: deleted ${total} user(s).`);
  }
  return total;
}

async function main() {
  const { dryRun, withAuth } = parseArgs(process.argv.slice(2));
  const { projectId, databaseId } = loadProjectConfig();

  console.log('\n=== CampusLink clear database ===\n');
  console.log(`Project:  ${projectId}`);
  console.log(`Database: ${databaseId}`);
  console.log(`Mode:     ${dryRun ? 'DRY RUN (no writes)' : 'DELETE'}\n`);

  if (!dryRun) {
    console.log('Starting in 3 seconds… (Ctrl+C to cancel)\n');
    await new Promise((r) => setTimeout(r, 3000));
  }

  const app = initAdmin(projectId);
  const db = getFirestore(app, databaseId);

  const counts = {};
  for (const name of COLLECTIONS) {
    try {
      counts[name] = await countCollection(db, name);
    } catch (e) {
      counts[name] = `(error: ${e.message})`;
    }
  }
  const configExists = (await db.collection('system').doc('config').get()).exists;
  counts['system/config'] = configExists ? 1 : 0;

  console.log('Documents to remove:');
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k}: ${v}`);
  }
  if (withAuth) {
    const auth = getAuth();
    const first = await auth.listUsers(1);
    console.log(`  auth users: ${first.users.length ? 'yes (will list & delete all)' : '0'}`);
  }
  console.log('');

  if (dryRun) {
    console.log('Dry run complete. Re-run with --confirm to delete.\n');
    process.exit(0);
  }

  for (const name of COLLECTIONS) {
    await deleteCollection(db, name, false);
  }
  const cfgDeleted = await deleteSystemConfig(db, false);
  if (cfgDeleted) console.log('  system/config: deleted 1 document.');

  if (withAuth) {
    await deleteAllAuthUsers(false);
  }

  console.log('\nDone. Open the app and click Initialize (login page, bottom right).\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('\nFailed:', err.message ?? err);
  if (String(err.message).includes('Could not load the default credentials')) {
    console.error(
      '\nSet GOOGLE_APPLICATION_CREDENTIALS to a service account JSON file, or run:\n' +
        '  gcloud auth application-default login --project YOUR_PROJECT_ID\n'
    );
  }
  process.exit(1);
});
