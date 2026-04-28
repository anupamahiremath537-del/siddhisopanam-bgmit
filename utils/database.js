const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const { supabaseConfigs } = require('../config/supabase');

// Create clients for each project
const supabaseClients = supabaseConfigs.map(config =>
  createClient(config.projectUrl, config.serviceRoleKey || config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
);

// Function to get the appropriate client (e.g., shard by ID or round-robin for load balancing)
function getSupabaseClient(shardKey) {
  if (typeof shardKey === 'number') {
    // Simple sharding example: modulo based on shardKey (e.g., user ID)
    const index = shardKey % supabaseClients.length;
    return supabaseClients[index];
  } else if (typeof shardKey === 'string') {
    // For strings, hash to a number
    let hash = 0;
    for (let i = 0; i < shardKey.length; i++) {
      hash = (hash << 5) - hash + shardKey.charCodeAt(i);
      hash |= 0; // Convert to 32-bit integer
    }
    const index = Math.abs(hash) % supabaseClients.length;
    return supabaseClients[index];
  } else {
    // Default to first client if no valid shardKey
    return supabaseClients[0];
  }
}

// For backward compatibility, default to the first client
const supabase = supabaseClients[0];

const normalizeField = k => ({ eventId: 'eventid', registrationId: 'registrationid', roleId: 'roleid', _id: 'id' }[k] || k.toLowerCase());

const mapRecord = r => {
  if (!r) return null;
  const fieldMap = { 
    eventid: 'eventId', 
    registrationid: 'registrationId', 
    roleid: 'roleId', 
    rolename: 'roleName',
    teamname: 'teamName',
    teammembers: 'teamMembers',
    teamid: 'teamId',
    issupportiveteam: 'isSupportiveTeam', 
    checkedin: 'checkedIn', 
    checkinat: 'checkedInAt',
    registeredat: 'registeredAt',
    volunteerroles: 'volunteerRoles',
    teammode: 'teamMode',
    teamsize: 'teamSize',
    participantlimit: 'participantLimit',
    registrationstatus: 'registrationStatus',
    registrationdeadline: 'registrationdeadline',
    createdat: 'createdAt',
    updatedat: 'updatedAt',
    approvedat: 'approvedAt',
    rejectedat: 'rejectedAt',
    cancelledat: 'cancelledAt',
    createdby: 'createdBy',
    expiresat: 'expiresAt',
    remindertime: 'reminderTime',
    hoursvolunteered: 'hoursVolunteered',
    certid: 'certId'
  };
  const m = {};
  for (const [k, v] of Object.entries(r)) {
    const key = fieldMap[k.toLowerCase()] || k;
    // Normalize booleans for known boolean fields
    const boolFields = [
      'isSupportiveTeam', 'checkedIn', 'noShow', 'swapRequested', 
      'approved', 'approve', 'isPast', 'ispast', 'sent'
    ];
    m[key] = (boolFields.includes(key.toLowerCase()) || boolFields.includes(key)) ? (v === true || v === 'true') : v;
    if (key.toLowerCase() === 'id') m._id = v;
  }
  return m;
};

const db = {
  async refreshSchema() { return; },
  async findOne(collection, query, options = {}) {
    const docs = await this.find(collection, query, { ...options, limit: 1 });
    return docs[0] || null;
  },
  async find(collection, query = {}, options = {}) {
    const { shardKey, ...opts } = options;
    const client = shardKey ? getSupabaseClient(shardKey) : supabase;
    let select = opts.select || '*';
    if (collection === 'registrations' && select === '*') {
      select = 'id,eventid,registrationid,name,email,phone,usn,password,type,roleid,rolename,teamname,teammembers,status,checkedin,registeredat,photo,teamid,userId,noshow,approvedat';
    }
    
    let b = client.from(collection).select(select);
    for (const [k, v] of Object.entries(query)) {
      const f = normalizeField(k);
      
      if (f === '$or' && Array.isArray(v)) {
        const orStr = v.map(cond => {
          const [ck, cv] = Object.entries(cond)[0];
          return `${normalizeField(ck)}.eq.${cv}`;
        }).join(',');
        b = b.or(orStr);
        continue;
      }
      
      if (f.startsWith('$')) continue; 
      
      if (v && typeof v === 'object' && v.$in) b = b.in(f, v.$in);
      else if (v && typeof v === 'object' && v.$ne) b = b.neq(f, v.$ne);
      else if (v instanceof RegExp) {
        let pattern = v.source;
        if (pattern.startsWith('^')) pattern = pattern.substring(1);
        if (pattern.endsWith('$')) pattern = pattern.substring(0, pattern.length - 1);
        pattern = pattern.replace(/\\(.)/g, '$1');
        b = b.ilike(f, pattern);
      }
      else b = b.eq(f, v);
    }
    if (options.sort) for (const [k, v] of Object.entries(options.sort)) b = b.order(normalizeField(k), { ascending: v !== -1 });
    if (options.limit) b = b.range(options.skip || 0, (options.skip || 0) + options.limit - 1);
    
    const { data, error } = await b;
    if (error) {
      console.error(`[DB Find Error] ${collection}:`, error);
      throw error;
    }
    return (data || []).map(mapRecord);
  },
  async count(collection, query, options = {}) {
    const { shardKey } = options;
    const client = shardKey ? getSupabaseClient(shardKey) : supabase;
    let b = client.from(collection).select('*', { count: 'exact', head: true });
    for (const [k, v] of Object.entries(query)) {
      const f = normalizeField(k);
      
      if (f === '$or' && Array.isArray(v)) {
        const orStr = v.map(cond => {
          const [ck, cv] = Object.entries(cond)[0];
          return `${normalizeField(ck)}.eq.${cv}`;
        }).join(',');
        b = b.or(orStr);
        continue;
      }

      if (f.startsWith('$')) continue;
      if (v && typeof v === 'object' && v.$ne) b = b.neq(f, v.$ne);
      else b = b.eq(f, v);
    }
    const { count, error } = await b;
    return error ? 0 : count || 0;
  },
  async insert(collection, doc) {
    const p = {};
    for (const [k, v] of Object.entries(doc)) p[normalizeField(k)] = v;
    if (!p.id) p.id = uuidv4();
    const { data, error } = await supabase.from(collection).insert(p).select();
    if (error) throw error;
    return mapRecord(data[0]);
  },
  async update(collection, query, update, options = {}) {
    const p = {};
    const d = update.$set || update;
    for (const [k, v] of Object.entries(d)) if (k !== 'id' && k !== '_id') p[normalizeField(k)] = v;
    
    let b = supabase.from(collection).update(p);
    
    // Support multiple query fields
    let hasQuery = false;
    for (const [k, v] of Object.entries(query)) {
      const f = normalizeField(k);
      if (f === 'id' || f === '_id') {
        b = b.eq('id', v);
        hasQuery = true;
      } else if (!f.startsWith('$')) {
        b = b.eq(f, v);
        hasQuery = true;
      }
    }

    if (!hasQuery) throw new Error('Update requires a query');

    const { error } = await b;
    if (error) throw error;
    return 1;
  },
  async remove(collection, query) {
    let b = supabase.from(collection).delete();        
    for (const [k, v] of Object.entries(query)) {      
      const f = normalizeField(k);
      if (f.startsWith('$')) continue;
      b = b.eq(f, v);
    }
    const { error } = await b;
    if (error) throw error;
    return 1;
  },
  async deleteRecord(collection, query) {
    return this.remove(collection, query);
  }
};

db.db = db;
db.supabase = supabase;
db.supabaseClients = supabaseClients;
db.getSupabaseClient = getSupabaseClient;

module.exports = db;

