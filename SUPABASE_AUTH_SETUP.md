# Supabase Authentication Setup Guide

## Overview
EventVault now uses Supabase Authentication for secure user management. This guide covers setup, configuration, and usage.

## Environment Variables

Add these to your `.env` file:

```env
# Supabase Configuration
SUPABASE_URL=https://ypvwihbpyduwyamvcznp.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwdndpaGJweWR1d3lhbXZjem5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODY3MTEsImV4cCI6MjA5MDg2MjcxMX0.gzzjuVEFSlgJLXV7nxjA_lS9Wq0sif2Lbt8U6JKybpg
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# App URLs
APP_URL=http://localhost:3000
RESET_PASSWORD_URL=http://localhost:3000/reset-password.html

# JWT Secret (for legacy support)
JWT_SECRET=your_jwt_secret_here
```

## Frontend Integration

### Include Supabase Client

Add to your HTML files:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="/js/supabase-config.js"></script>
```

### Available Frontend Functions

#### Sign Up
```javascript
const result = await signUp(email, password, {
  name: 'John Doe',
  usn: '2LB23CS001',
  phone: '+91 1234567890',
  type: 'participant'
});

if (result.success) {
  console.log('User created:', result.user);
} else {
  console.error('Signup failed:', result.error);
}
```

#### Sign In
```javascript
const result = await signIn(email, password);

if (result.success) {
  console.log('Logged in:', result.user);
  const token = result.session.access_token;
} else {
  console.error('Login failed:', result.error);
}
```

#### Sign Out
```javascript
const result = await signOut();
if (result.success) {
  console.log('Signed out');
}
```

#### Get Current User
```javascript
const user = getCurrentUser();
console.log('Current user:', user);
```

#### Get Auth Token
```javascript
const token = getAuthToken();
// Use for authenticated API requests
```

#### Reset Password
```javascript
const result = await resetPassword(email);
if (result.success) {
  console.log('Reset email sent');
}
```

#### Authenticated API Requests
```javascript
const response = await authenticatedFetch('/api/events', {
  method: 'GET'
});
```

## Backend API Endpoints

### 1. Sign Up
**Endpoint:** `POST /api/supabase-auth/signup`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe",
  "usn": "2LB23CS001",
  "phone": "+91 1234567890",
  "type": "participant"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Account created successfully",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "user_metadata": {
      "name": "John Doe",
      "usn": "2LB23CS001"
    }
  }
}
```

### 2. Sign In
**Endpoint:** `POST /api/supabase-auth/signin`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "user": { ... },
  "session": {
    "access_token": "jwt_token_here",
    "refresh_token": "refresh_token_here"
  }
}
```

### 3. Sign Out
**Endpoint:** `POST /api/supabase-auth/signout`

**Headers:**
```
Authorization: Bearer {access_token}
```

### 4. Get User Profile
**Endpoint:** `GET /api/supabase-auth/user`

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "success": true,
  "user": { ... },
  "profile": {
    "id": "user-uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "usn": "2LB23CS001",
    "phone": "+91 1234567890",
    "type": "participant",
    "createdAt": "2026-04-04T12:00:00Z"
  }
}
```

### 5. Reset Password
**Endpoint:** `POST /api/supabase-auth/reset-password`

**Request:**
```json
{
  "email": "user@example.com"
}
```

### 6. Update Password
**Endpoint:** `POST /api/supabase-auth/update-password`

**Headers:**
```
Authorization: Bearer {access_token}
```

**Request:**
```json
{
  "newPassword": "newSecurePassword123"
}
```

### 7. Refresh Token
**Endpoint:** `POST /api/supabase-auth/refresh-token`

**Request:**
```json
{
  "refreshToken": "refresh_token_here"
}
```

## Auth UI Page

Access the Supabase auth UI at: `http://localhost:3000/supabase-auth.html`

Features:
- Sign In
- Sign Up
- Reset Password
- View authenticated user info

## Middleware Usage

### Protect API Routes

```javascript
const supabaseAuth = require('../middleware/supabase-auth');
const router = require('express').Router();

// Protect this route
router.get('/protected-endpoint', supabaseAuth, (req, res) => {
  console.log('User:', req.user);
  res.json({ message: 'Protected data' });
});
```

## Database Integration

The auth system automatically creates user profiles in the `users` table:

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text,
  usn text,
  phone text,
  type text,
  createdAt timestamp,
  updated_at timestamp DEFAULT CURRENT_TIMESTAMP
);
```

## Security Best Practices

1. **Never expose service role key**: Only use it on the backend
2. **Use HTTPS**: Always use secure connections in production
3. **Store tokens securely**: Keep tokens in localStorage or secure cookies
4. **Validate on backend**: Always validate tokens on protected endpoints
5. **Use row-level security**: Set up RLS policies for database access
6. **Email verification**: Enable email confirmation in Supabase settings

## Supabase Console

Access your Supabase project:
- **URL**: https://app.supabase.com
- **Project**: Select EventVault project
- **Database**: postgres://
- **Auth**: User management and settings

## Troubleshooting

### User Already Exists
If you get "User already registered", check:
- Email isn't already registered in Supabase Auth
- Check Users table for duplicate profiles

### Invalid Token
- Token may be expired
- Use refresh token to get new access token
- Check token format (should start with "eyJ...")

### Password Reset Not Working
- Verify RESET_PASSWORD_URL is set correctly
- Check email provider is configured in Supabase
- Verify SMTP settings if using custom domain

## Migration from Firebase

If migrating from Firebase auth:
1. Create Supabase auth users programmatically
2. Update frontend to use supabase-config.js
3. Update API endpoints to use /api/supabase-auth
4. Test all auth flows before deploying

## Next Steps

1. ✅ Set up environment variables in `.env`
2. ✅ Install @supabase/supabase-js: `npm install @supabase/supabase-js`
3. ✅ Test auth endpoints using the UI page
4. ✅ Integrate Supabase auth into your application pages
5. ✅ Set up RLS policies for data security
