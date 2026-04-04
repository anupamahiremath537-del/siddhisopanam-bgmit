const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

const exportDir = path.join(__dirname, '../firestore-export');

function ensureExportDir() {
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }
}

function loadFirebaseServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  }

  const serviceAccountFile = path.join(__dirname, '../firebase-service-account.json');
  if (fs.existsSync(serviceAccountFile)) {
    return require(serviceAccountFile);
  }

  throw new Error('Firebase service account not found. Set FIREBASE_SERVICE_ACCOUNT or place firebase-service-account.json in the repository root.');
}

function createSupabaseClient() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables.');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function normalizeFirestoreValue(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate().toISOString();
  }
  if (value instanceof admin.firestore.GeoPoint) {
    return { latitude: value.latitude, longitude: value.longitude };
  }
  if (value instanceof admin.firestore.DocumentReference) {
    return value.path;
  }
  if (Array.isArray(value)) {
    return value.map(normalizeFirestoreValue);
  }
  if (value && typeof value === 'object') {
    const next = {};
    for (const [k, v] of Object.entries(value)) {
      next[k] = normalizeFirestoreValue(v);
    }
    return next;
  }
  return value;
}

function normalizeFirestoreDoc(doc) {
  const data = doc.data();
  const normalized = {};
  for (const [key, value] of Object.entries(data)) {
    normalized[key] = normalizeFirestoreValue(value);
  }
  normalized.id = doc.id;
  return normalized;
}

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function getCollections(firestore) {
  const collections = await firestore.listCollections();
  return collections.map(col => col.id);
}

async function exportCollection(firestore, collectionName) {
  console.log(`Exporting collection: ${collectionName}`);
  const snapshot = await firestore.collection(collectionName).get();
  const docs = snapshot.docs.map(normalizeFirestoreDoc);
  const filePath = path.join(exportDir, `${collectionName}.json`);
  fs.writeFileSync(filePath, JSON.stringify(docs, null, 2));
  console.log(`  saved ${docs.length} docs to ${filePath}`);
  return docs;
}

async function importCollection(supabase, collectionName, docs) {
  console.log(`Importing collection: ${collectionName} (${docs.length} docs)`);
  if (!docs.length) {
    console.log('  skipping empty collection');
    return;
  }

  // Try direct insert for each doc
  let successCount = 0;
  for (const doc of docs) {
    try {
      const { error } = await supabase
        .from(collectionName)
        .insert([doc], { returning: 'minimal' });

      if (error) {
        if (error.code === '23505' || error.message.includes('duplicate')) {
          // Try delete and re-insert
          await supabase.from(collectionName).delete().eq('id', doc.id);
          await supabase.from(collectionName).insert([doc], { returning: 'minimal' });
        } else {
          console.warn(`    Warning: ${doc.id} - ${error.message}`);
        }
      }
      successCount++;
    } catch (err) {
      console.warn(`    Error: ${doc.id} - ${err.message}`);
    }
  }
  console.log(`  imported ${successCount}/${docs.length} docs\n`);
}

async function exportAll(firestore) {
  ensureExportDir();
  const collectionNames = await getCollections(firestore);
  const exported = {};
  for (const name of collectionNames) {
    exported[name] = await exportCollection(firestore, name);
  }
  return exported;
}

async function importAll(supabase, exports) {
  for (const [collectionName, docs] of Object.entries(exports)) {
    await importCollection(supabase, collectionName, docs);
  }
}

async function run() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY before running this script.');
  }

  const action = process.argv[2] || 'export';
  const firebaseConfig = loadFirebaseServiceAccount();
  admin.initializeApp({ credential: admin.credential.cert(firebaseConfig) });
  const firestore = admin.firestore();
  const supabase = createSupabaseClient();

  if (action === 'export') {
    await exportAll(firestore);
    console.log('\nExport complete. JSON files are in firestore-export/.');
    return;
  }

  if (action === 'import') {
    const exports = {};
    ensureExportDir();
    const files = fs.readdirSync(exportDir).filter(f => f.endsWith('.json'));
    if (!files.length) {
      throw new Error('No export files found in firestore-export/. Run this script with `export` first.');
    }
    for (const file of files) {
      const name = path.basename(file, '.json');
      const docs = JSON.parse(fs.readFileSync(path.join(exportDir, file), 'utf-8'));
      exports[name] = docs;
    }
    await importAll(supabase, exports);
    console.log('\nImport complete. Data should now be in Supabase.');
    return;
  }

  if (action === 'both') {
    const exports = await exportAll(firestore);
    await importAll(supabase, exports);
    console.log('\nExport + import complete.');
    return;
  }

  throw new Error('Unknown action. Use: export | import | both');
}

run().catch(err => {
  console.error('Migration failed:', err.message || err);
  process.exit(1);
});
