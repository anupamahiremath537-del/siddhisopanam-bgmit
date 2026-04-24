const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const normalizeField = k => ({ eventId: 'eventid', registrationId: 'registrationid', roleId: 'roleid', _id: 'id' }[k] || k.toLowerCase());

const mapRecord = r => {
  if (!r) return null;
  const fieldMap = { 
    eventid: 'eventId', 
    registrationid: 'registrationId', 
    roleid: 'roleId', 
    issupportiveteam: 'isSupportiveTeam', 
    checkedin: 'checkedIn', 
    registeredat: 'registeredAt',
    volunteerroles: 'volunteerRoles'
  };
  const m = {};
  for (const [k, v] of Object.entries(r)) {
    const key = fieldMap[k.toLowerCase()] || k;
    m[key] = (['isSupportiveTeam', 'checkedIn', 'noShow', 'swapRequested', 'approved', 'approve'].includes(key)) ? (v === true || v === 'true') : v;
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
    let select = options.select || '*';
    if (collection === 'registrations' && select === '*') select = 'id,eventid,registrationid,name,email,phone,usn,type,roleid,rolename,teamname,status,checkedin,registeredat';
    
    let b = supabase.from(collection).select(select);
    for (const [k, v] of Object.entries(query)) {
      const f = normalizeField(k);
      // SAFETY: Completely ignore $or and other complex keys to prevent SQL errors
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
    if (error) throw error;
    return (data || []).map(mapRecord);
  },
  async count(collection, query) {
    let b = supabase.from(collection).select('*', { count: 'exact', head: true });
    for (const [k, v] of Object.entries(query)) {
      const f = normalizeField(k);
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
      if (f === 'id' || f === '_id' || f === 'registrationid') {
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

module.exports = db;
