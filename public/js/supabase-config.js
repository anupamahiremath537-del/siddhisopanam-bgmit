// Supabase Client Configuration for EventVault
const SUPABASE_URL = 'https://ypvwihbpyduwyamvcznp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwdndpaGJweWR1d3lhbXZjem5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODY3MTEsImV4cCI6MjA5MDg2MjcxMX0.gzzjuVEFSlgJLXV7nxjA_lS9Wq0sif2Lbt8U6JKybpg';

// Initialize Supabase client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Auth state management
let currentUser = null;

// Initialize auth state listener
supabaseClient.auth.onAuthStateChange((event, session) => {
  if (session) {
    currentUser = session.user;
    localStorage.setItem('sb_token', session.access_token);
    localStorage.setItem('sb_user', JSON.stringify(currentUser));
    console.log('User logged in:', currentUser.email);
  } else {
    currentUser = null;
    localStorage.removeItem('sb_token');
    localStorage.removeItem('sb_user');
    console.log('User logged out');
  }
});

// Get current user
function getCurrentUser() {
  return currentUser || JSON.parse(localStorage.getItem('sb_user'));
}

// Get auth token
function getAuthToken() {
  return localStorage.getItem('sb_token');
}

// Sign up with email and password
async function signUp(email, password, userData = {}) {
  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: userData
      }
    });

    if (error) throw error;
    return { success: true, user: data.user };
  } catch (err) {
    console.error('Sign up error:', err.message);
    return { success: false, error: err.message };
  }
}

// Sign in with email and password
async function signIn(email, password) {
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    return { success: true, user: data.user, session: data.session };
  } catch (err) {
    console.error('Sign in error:', err.message);
    return { success: false, error: err.message };
  }
}

// Sign out
async function signOut() {
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('Sign out error:', err.message);
    return { success: false, error: err.message };
  }
}

// Send password reset email
async function resetPassword(email) {
  try {
    const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password.html`
    });

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('Reset password error:', err.message);
    return { success: false, error: err.message };
  }
}

// Update user password
async function updatePassword(newPassword) {
  try {
    const { data, error } = await supabaseClient.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('Update password error:', err.message);
    return { success: false, error: err.message };
  }
}

// Get user session
async function getSession() {
  try {
    const { data } = await supabaseClient.auth.getSession();
    return data.session;
  } catch (err) {
    console.error('Get session error:', err.message);
    return null;
  }
}

// API request with auth token
async function authenticatedFetch(url, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers
  });
}
