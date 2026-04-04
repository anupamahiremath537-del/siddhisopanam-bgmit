# Firebase Archive

This folder contains deprecated Firebase configuration and functions that were replaced during the migration to Supabase.

## Contents

- **firebase-service-account.json** - Firebase service account credentials (replaced by Supabase)
- **firebase.json** - Firebase deployment configuration
- **firestore.indexes.json** - Firestore database indexes
- **firestore.rules** - Firestore security rules
- **.firebase/** - Firebase CLI configuration directory
- **eventvault-func/** - Firebase Cloud Functions (replaced by Supabase Edge Functions)
- **dataconnect/** - Google Cloud Data Connect configuration

## Why Archived?

EventVault has migrated from Firebase to Supabase for:
- Better PostgreSQL integration
- Easier row-level security (RLS) policies
- Cost efficiency
- Simplified data management

## If You Need Firebase Again

1. Restore files from this archive
2. Update `.env` with Firebase credentials
3. Update `server.js` to uncomment Firebase imports
4. Deploy to Firebase using `firebase deploy`

## Current Status

✅ All data migrated to Supabase  
✅ Authentication now using Supabase Auth  
✅ Database queries use Supabase client  
✅ Firebase is no longer required

---

**Archived Date**: 2026-04-04  
**Migration Status**: Complete
