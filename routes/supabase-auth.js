// Supabase Auth Routes
const router = require('express').Router();
const { createClient } = require('@supabase/supabase-js');
const supabaseConfig = require('../config/supabase');

// Initialize Supabase Admin client for server-side operations
const supabase = createClient(supabaseConfig.projectUrl, supabaseConfig.serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// POST /api/supabase-auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name, usn, phone, type } = req.body;

    if (!email || !password || !name || !usn) {
      return res.status(400).json({ error: 'Email, password, name, and USN are required' });
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: {
        name,
        usn,
        phone: phone || '',
        type: type || 'participant'
      }
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    // Create user profile in users table
    const { error: profileError } = await supabase
      .from('users')
      .insert([
        {
          id: authData.user.id,
          email: email.toLowerCase(),
          name,
          usn: usn.toUpperCase(),
          phone: phone || '',
          type: type || 'participant',
          createdAt: new Date().toISOString()
        }
      ]);

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Optionally delete the auth user if profile creation fails
    }

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: authData.user
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/supabase-auth/signin
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    res.json({
      success: true,
      user: data.user,
      session: data.session
    });
  } catch (err) {
    console.error('Signin error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/supabase-auth/signout
router.post('/signout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (token) {
      await supabase.auth.admin.signOut(token);
    }

    res.json({ success: true, message: 'Signed out successfully' });
  } catch (err) {
    console.error('Signout error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/supabase-auth/refresh-token
router.post('/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    res.json({
      success: true,
      session: data.session
    });
  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/supabase-auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: process.env.RESET_PASSWORD_URL || `${process.env.APP_URL}/reset-password.html`
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true, message: 'Password reset email sent' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/supabase-auth/update-password
router.post('/update-password', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required' });
    }

    const { data, error } = await supabase.auth.admin.updateUserById(token, {
      password: newPassword
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('Update password error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/supabase-auth/user
router.get('/user', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get user profile from users table
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    res.json({
      success: true,
      user: data.user,
      profile
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
