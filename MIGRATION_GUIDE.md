# Firestore to Supabase Migration Guide

## Prerequisites

1. Supabase project set up and running
2. Environment variables configured:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `FIREBASE_SERVICE_ACCOUNT` (Firebase service account JSON)

## Step-by-Step Migration

### Step 1: Export Firestore Data

```powershell
$env:SUPABASE_URL = "https://your-project.supabase.co"
$env:SUPABASE_SERVICE_KEY = "your-service-key"
$env:FIREBASE_SERVICE_ACCOUNT = Get-Content .\firebase-service-account.json -Raw

npm run migrate:firestore-to-supabase export
```

**Result**: JSON files exported to `firestore-export/` directory

### Step 2: Create Supabase Tables

```powershell
npm run migrate:create-tables
```

**What it does**:
- Reads exported JSON files
- Infers column types from data (text, number, boolean, timestamp, jsonb)
- Creates tables automatically
- Ensures `id` column is primary key

### Step 3: Import Data into Supabase

```powershell
npm run migrate:firestore-to-supabase import
```

**Result**: All data migrated to Supabase tables

## Alternative: One-Step Migration

```powershell
npm run migrate:firestore-to-supabase both
```

Then follow with table creation:

```powershell
npm run migrate:create-tables
```

## Manual SQL (Alternative to Script)

If you prefer to create tables manually in Supabase SQL Editor:

```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  displayName TEXT,
  photoURL TEXT,
  createdAt TIMESTAMP
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  date TEXT,
  time TEXT,
  location TEXT,
  category TEXT,
  eventImage TEXT,
  createdBy TEXT,
  createdAt TIMESTAMP
);

-- Registrations table
CREATE TABLE IF NOT EXISTS registrations (
  id TEXT PRIMARY KEY,
  eventId TEXT,
  userId TEXT,
  registeredAt TIMESTAMP
);

-- More tables as needed...
```

## Troubleshooting

**Export fails**: Ensure Firebase service account is valid and has Firestore read permissions.

**Table creation fails**: Verify Supabase credentials are correct. Check Supabase SQL editor for existing tables.

**Import fails**: Ensure tables exist with matching collection names. Check data types match.

## Rollback

If anything goes wrong:
1. Delete tables from Supabase SQL Editor
2. Exported JSON files remain in `firestore-export/` for re-import
3. Run the migration again

## Verification

After migration completes:

1. Check Supabase dashboard → SQL Editor → Tables
2. Verify row counts match exported JSON files
3. Test API routes that use the database
4. Monitor CloudWatch/logs for any errors

---

**Scripts location**: `scripts/migrate_firestore_to_supabase.js`, `scripts/create_supabase_tables.js`

**Export location**: `firestore-export/` (created after export)
