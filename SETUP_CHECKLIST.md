# Supabase Auth Setup Checklist

## ✅ Files Created

- [x] [config/supabase.js](../config/supabase.js) - Backend Supabase config
- [x] [middleware/supabase-auth.js](../middleware/supabase-auth.js) - Auth middleware
- [x] [routes/supabase-auth.js](../routes/supabase-auth.js) - Auth routes (7 endpoints)
- [x] [public/js/supabase-config.js](../public/js/supabase-config.js) - Frontend client & helpers
- [x] [public/supabase-auth.html](../public/supabase-auth.html) - Interactive auth UI
- [x] [SUPABASE_AUTH_SETUP.md](../SUPABASE_AUTH_SETUP.md) - Complete documentation
- [x] [SUPABASE_AUTH_QUICK_START.md](../SUPABASE_AUTH_QUICK_START.md) - Quick reference
- [x] [.env.example](.env.example) - Environment template
- [x] [server.js](../server.js) - Updated with auth routes

## 🔧 Setup Steps

### Step 1: Environment Configuration
- [ ] Copy `.env.example` to `.env`
- [ ] Fill in `SUPABASE_URL` (already filled)
- [ ] Fill in `SUPABASE_ANON_KEY` (already filled)
- [ ] Get `SUPABASE_SERVICE_ROLE_KEY` from Supabase dashboard
  1. Go to https://app.supabase.com
  2. Select EventVault project
  3. Settings → API → Service Role Key
  4. Copy and paste into `.env`
- [ ] Fill in other email/security variables

### Step 2: Start the Application
```bash
# Install dependencies (if needed)
npm install

# Start development server
npm run dev
# or for production
npm start
```

### Step 3: Test Authentication

#### Method A: Web UI (Easiest)
1. Open browser: `http://localhost:3000/supabase-auth.html`
2. Click "Sign Up" tab
3. Fill in test user details:
   - Name: Test User
   - Email: test@example.com
   - USN: 2LB23CS999
   - Password: TestPassword123
4. Click "Create Account"
5. Try signing in with those credentials

#### Method B: Browser Console
1. Open DevTools (F12)
2. Go to Console tab
3. Paste:
```javascript
await signUp('devtest@example.com', 'DevTest123', {
  name: 'Dev Test',
  usn: '2LB23CS998',
  type: 'participant'
});
```

#### Method C: API Testing (curl)
```bash
# Sign Up
curl -X POST http://localhost:3000/api/supabase-auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email":"apitest@example.com",
    "password":"ApiTest123",
    "name":"API Test",
    "usn":"2LB23CS997",
    "type":"participant"
  }'

# Sign In
curl -X POST http://localhost:3000/api/supabase-auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email":"apitest@example.com",
    "password":"ApiTest123"
  }'
```

### Step 4: Verify Database

Check Supabase dashboard to confirm users created:
1. Go to https://app.supabase.com
2. Select EventVault project
3. Database → Tables → users
4. Should see test users created above

## 🔐 Backend Integration

### Protect Your Routes

Add auth middleware to routes that need login:

```javascript
const supabaseAuth = require('./middleware/supabase-auth');

// Example: Protect event registration
router.post('/register-event', supabaseAuth, async (req, res) => {
  const userId = req.user.id;
  const userEmail = req.user.email;
  // ... your registration logic
});
```

### Available Request Properties

When middleware is applied, `req.user` has:
```javascript
req.user = {
  id: 'uuid',           // Supabase user ID
  email: 'user@example.com',
  user_metadata: {      // Custom data
    name: 'John Doe',
    usn: '2LB23CS001',
    phone: '+91...',
    type: 'participant'
  }
}
```

## 📱 Frontend Integration

### Step 1: Add Supabase to Your HTML

```html
<!DOCTYPE html>
<html>
<head>
  <title>EventVault</title>
</head>
<body>
  <!-- Your content -->
  
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="/js/supabase-config.js"></script>
  
  <script>
    // Now you can use auth functions
    const user = getCurrentUser();
    if (!user) {
      document.location.href = '/supabase-auth.html';
    }
  </script>
</body>
</html>
```

### Step 2: Use Auth Functions

**Check login status:**
```javascript
const user = getCurrentUser();
if (user) {
  console.log('Logged in as:', user.email);
}
```

**Make authenticated API calls:**
```javascript
// Instead of fetch(), use authenticatedFetch()
const response = await authenticatedFetch('/api/events', {
  method: 'GET'
});
const events = await response.json();
```

**Handle logout:**
```javascript
await signOut();
window.location.href = '/supabase-auth.html';
```

## 📊 Available Endpoints

All endpoints under `/api/supabase-auth`:

| Endpoint | Method | Requires Auth | Purpose |
|----------|--------|---------------|---------|
| `/signup` | POST | ❌ | Create account |
| `/signin` | POST | ❌ | Login |
| `/signout` | POST | ✅ | Logout |
| `/user` | GET | ✅ | Get profile |
| `/refresh-token` | POST | ❌ | Get new token |
| `/reset-password` | POST | ❌ | Password reset |
| `/update-password` | POST | ✅ | Change password |

## 🐛 Troubleshooting

### "SUPABASE_URL is not defined"
- [ ] Check `.env` file exists
- [ ] Verify SUPABASE_URL is set
- [ ] Restart the server

### "User already exists"
- [ ] Email is already registered
- [ ] Try a different email address
- [ ] Check Supabase users table

### "Invalid password"
- [ ] Password must be at least 6 characters
- [ ] Try a stronger password
- [ ] Check for typos

### "Column does not exist"
- [ ] Database tables might not be created
- [ ] Run: `npm run migrate:create-tables`
- [ ] Then: `npm run migrate:firestore-to-supabase`

### Auth middleware not working
- [ ] Verify token is being sent: `Authorization: Bearer {token}`
- [ ] Check token is not expired
- [ ] Verify route has auth middleware applied

## 📋 Production Checklist

Before deploying to production:

- [ ] All `.env` variables are set
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is secure
- [ ] HTTPS is enabled
- [ ] Email verification is configured
- [ ] Password reset emails work
- [ ] RLS policies are set in Supabase
- [ ] Database backups are enabled
- [ ] Auth logs are being monitored
- [ ] Rate limiting is configured
- [ ] CORS is properly configured

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| [SUPABASE_AUTH_SETUP.md](../SUPABASE_AUTH_SETUP.md) | Complete detailed guide |
| [SUPABASE_AUTH_QUICK_START.md](../SUPABASE_AUTH_QUICK_START.md) | Quick reference |
| [SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md) | This file |
| [.env.example](.env.example) | Environment template |

## 🚀 Quick Commands

```bash
# Start dev server
npm run dev

# Create database tables
npm run migrate:create-tables

# Import Firestore data
npm run migrate:firestore-to-supabase

# Install dependencies
npm install

# Start production server
npm start
```

## ✨ What's Next

1. **Test Auth** - Use `/supabase-auth.html`
2. **Protect Routes** - Add middleware to sensitive endpoints
3. **Update Frontend** - Integrate auth into your pages
4. **Set RLS** - Configure row-level security in Supabase
5. **Deploy** - Push to production

## 📞 Support

For issues:
1. Check the troubleshooting section above
2. Review [SUPABASE_AUTH_SETUP.md](../SUPABASE_AUTH_SETUP.md)
3. Check Supabase logs: https://app.supabase.com → Logs
4. Check server logs: Look at terminal output

---

**Status**: ✅ Supabase Auth is fully set up and ready to use!

**Last Updated**: 2026-04-04
**Version**: 1.0.0
