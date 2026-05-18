// Supabase Auth Middleware
const { createClient } = require('@supabase/supabase-js');
const supabaseConfig = require('../config/supabase');

const supabase = createClient(supabaseConfig.projectUrl, supabaseConfig.serviceRoleKey || supabaseConfig.anonKey);

const supabaseAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = req.query.token || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify token with Supabase
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = {
      id: data.user.id,
      email: data.user.email,
      user_metadata: data.user.user_metadata || {}
    };

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

module.exports = supabaseAuth;
