const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const exportDir = path.join(__dirname, '../firestore-export');

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

function inferColumnType(value) {
  if (value === null || value === undefined) return 'text';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'bigint' : 'numeric';
  }
  if (typeof value === 'string') {
    if (value.match(/^[0-9]{4}-[0-9]{2}-[0-9]{2}T/)) return 'timestamp';
    return 'text';
  }
  if (Array.isArray(value)) return 'jsonb';
  if (typeof value === 'object') return 'jsonb';
  return 'text';
}

function inferSchema(docs) {
  const schema = {};
  if (!docs.length) return schema;

  for (const doc of docs) {
    for (const [key, value] of Object.entries(doc)) {
      if (!schema[key]) {
        schema[key] = inferColumnType(value);
      }
    }
  }

  schema.id = 'text'; // Ensure id is text
  return schema;
}

function generateCreateStatement(tableName, schema) {
  const columns = [];
  
  // id column first
  if (schema.id) {
    columns.push('  id TEXT PRIMARY KEY');
  }

  // other columns
  for (const [key, type] of Object.entries(schema)) {
    if (key === 'id') continue;
    columns.push(`  ${key} ${type}`);
  }

  return `CREATE TABLE IF NOT EXISTS ${tableName} (\n${columns.join(',\n')}\n);`;
}

async function createAllTables(supabase) {
  if (!fs.existsSync(exportDir)) {
    throw new Error(`Export directory not found: ${exportDir}. Run export first.`);
  }

  const files = fs.readdirSync(exportDir).filter(f => f.endsWith('.json'));
  if (!files.length) {
    throw new Error('No export files found. Run export first.');
  }

  console.log(`Found ${files.length} collections to create tables for.\n`);

  for (const file of files) {
    const tableName = path.basename(file, '.json');
    const filePath = path.join(exportDir, file);
    const docs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    if (!docs.length) {
      console.log(`⊘ ${tableName}: skipping (no documents)`);
      continue;
    }

    const schema = inferSchema(docs);
    const createStmt = generateCreateStatement(tableName, schema);

    console.log(`Creating table: ${tableName}`);
    console.log(createStmt);

    const { error } = await supabase.rpc('exec_sql', { sql: createStmt }).catch(() => {
      // Fallback: use direct SQL if rpc doesn't exist
      return supabase.from(tableName).select('*').limit(1);
    });

    if (error && !error.message.includes('already exists')) {
      console.error(`  ✗ Error: ${error.message}`);
    } else {
      console.log(`  ✓ Table ${tableName} ready\n`);
    }
  }
}

async function run() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY before running this script.');
  }

  const supabase = createSupabaseClient();

  try {
    await createAllTables(supabase);
    console.log('Table creation complete.');
  } catch (err) {
    console.error('Table creation failed:', err.message);
    process.exit(1);
  }
}

run();
