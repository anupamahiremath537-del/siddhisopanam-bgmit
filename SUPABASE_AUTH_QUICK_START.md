# Supabase Auth - Quick Setup

## What's Been Created

✅ **Backend Configuration:**
- [config/supabase.js](../config/supabase.js) - Supabase configuration
- [middleware/supabase-auth.js](../middleware/supabase-auth.js) - Auth middleware for protected routes
- [routes/supabase-auth.js](../routes/supabase-auth.js) - All auth endpoints

✅ **Frontend Configuration:**
- [public/js/supabase-config.js](../public/js/supabase-config.js) - Supabase client & helper functions
- [public/supabase-auth.html](../public/supabase-auth.html) - Interactive auth UI page

✅ **Documentation:**
- [SUPABASE_AUTH_SETUP.md](../SUPABASE_AUTH_SETUP.md) - Comprehensive guide
- This file for quick reference

## Environment Setup

Add to your `.env` file:

```env
# Supabase
SUPABASE_URL=https://ypvwihbpyduwyamvcznp.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwdndpaGJweWR1d3lhbXZjem5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODY3MTEsImV4cCI6MjA5MDg2MjcxMX0.gzzjuVEFSlgJLXV7nxjA_lS9Wq0sif2Lbt8U6JKybpg
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

APP_URL=http://localhost:3000
RESET_PASSWORD_URL=http://localhost:3000/reset-password.html
JWT_SECRET=your-jwt-secret-here
```

## API Endpoints

All endpoints are under `/api/supabase-auth`:

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/signup` | POST | ❌ | Create new account |
| `/signin` | POST | ❌ | Login with email/password |
| `/signout` | POST | ✅ | Logout |
| `/user` | GET | ✅ | Get current user profile |
| `/refresh-token` | POST | ❌ | Get new access token |
| `/reset-password` | POST | ❌ | Send password reset email |
| `/update-password` | POST | ✅ | Change password |

## Testing Auth System

### 1. Using the Auth UI Page
```
http://localhost:3000/supabase-auth.html
```

### 2. Using JavaScript (in browser console)
```javascript
// Sign Up
await signUp('user@example.com', 'Password123', {
  name: 'John Doe',
  usn: '2LB23CS001',
  phone: '+91 9876543210',
  type: 'participant'
});

// Sign In
const result = await signIn('user@example.com', 'Password123');
console.log('Token:', result.session.access_token);

// Get User
const user = getCurrentUser();
console.log('Current user:', user);

// Sign Out
await signOut();
```

### 3. Using API (with curl)
```bash
# Sign Up
curl -X POST http://localhost:3000/api/supabase-auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123",
    "name": "John Doe",
    "usn": "2LB23CS001",
    "phone": "+91 9876543210",
    "type": "participant"
  }'

# Sign In
curl -X POST http://localhost:3000/api/supabase-auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123"
  }'

# Get User (replace TOKEN with actual token)
curl -X GET http://localhost:3000/api/supabase-auth/user \
  -H "Authorization: Bearer TOKEN"
```

## Protecting Routes

Add auth middleware to any route:

```javascript
const supabaseAuth = require('../middleware/supabase-auth');

// Protect this endpoint
router.post('/my-endpoint', supabaseAuth, async (req, res) => {
  const user = req.user; // req.user is automatically set by middleware
  res.json({ message: 'Protected data', user });
});
```

## Integration with EventVault

### Update HTML Pages

Add to pages that need auth:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="/js/supabase-config.js"></script>

<script>
  // Check if user is logged in
  document.addEventListener('DOMContentLoaded', async () => {
    const user = getCurrentUser();
    if (!user) {
      window.location.href = '/supabase-auth.html';
    }
  });
</script>
```

### Using Authenticated API Calls

```javascript
// Instead of fetch(), use authenticatedFetch()
const response = await authenticatedFetch('/api/events', {
  method: 'GET'
});

const events = await response.json();
console.log('Events:', events);
```

## User Table Schema

The system automatically creates user profiles:

```sql
/* Users Table */
id (UUID) - Primary key
email (text) - Unique email
name (text) - Full name
usn (text) - University Serial Number
phone (text) - Contact number
type (text) - 'participant' or 'volunteer'
createdAt (timestamp) - Account creation date
updated_at (timestamp) - Last update time
```

## Common Tasks

### Check if user is logged in

```javascript
const user = getCurrentUser();
if (user) {
  console.log('User logged in as:', user.email);
} else {
  console.log('No user logged in');
}
```

### Get auth token for API requests

```javascript
const token = getAuthToken();
if (token) {
  // User is authenticated
}
```

### Handle logout

```javascript
await signOut();
// Redirect to login
window.location.href = '/supabase-auth.html';
```

### Reset user password

```javascript
await resetPassword('user@example.com');
// User receives email with reset link
```

## Debugging

Enable console logging:

```javascript
// Add this to supabase-config.js
supabaseClient.auth.onAuthStateChange((event, session) => {
  console.log('Auth event:', event);
  console.log('Session:', session);
});
```

Check browser console (F12) for auth events.

## Next Steps

1. **Test the auth system** using the UI page
2. **Integrate auth** into EventVault pages (events, registrations, etc.)
3. **Set up RLS policies** in Supabase for data security
4. **Deploy** to production with proper environment variables
5. **Monitor auth** logs in Supabase dashboard

## Support

- **Supabase Docs**: https://supabase.com/docs/guides/auth
- **Supabase Dashboard**: https://app.supabase.com
- **Full Setup Guide**: See [SUPABASE_AUTH_SETUP.md](../SUPABASE_AUTH_SETUP.md)
