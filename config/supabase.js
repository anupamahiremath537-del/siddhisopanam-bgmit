// Supabase Configuration for multiple projects
const supabaseConfigs = [
  {
    projectUrl: process.env.SUPABASE_URL_1 || process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY_1 || process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY_1 || process.env.SUPABASE_SERVICE_ROLE_KEY
  }
];

// Export primary config directly for backward compatibility
module.exports = { 
  supabaseConfigs,
  projectUrl: supabaseConfigs[0].projectUrl,
  anonKey: supabaseConfigs[0].anonKey,
  serviceRoleKey: supabaseConfigs[0].serviceRoleKey
};
