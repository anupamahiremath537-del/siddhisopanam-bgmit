const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const normalizeField = key => {
  const map = { eventId: 'eventid', registrationId: 'registrationid', roleId: 'roleid', _id: 'id' };
  return map[key] || key.toLowerCase(); 
};

const mapRecord = r => {
  if (!r) return null;
  const fieldMap = { eventid: 'eventId', registrationid: 'registrationId', roleid: 'roleId', issupportiveteam: 'isSupportiveTeam', checkedin: 'checkedIn', registeredat: 'registeredAt' };
  const mapped = {};
  for (const [k, v] of Object.entries(r)) {
    const key = fieldMap[k.toLowerCase()] || k;
    mapped[key] = (['isSupportiveTeam', 'checkedIn', 'noShow', 'swapRequested'].includes(key)) ? (v === true || v === 'true') : v;
    if (key.toLowerCase() === 'id') mapped._id = v;
  }
  return mapped;
};

const db = {
  async refreshSchema() { return; }, // Placeholder for compatibility
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
      if (v && typeof v === 'object' && v.$in) b = b.in(f, v.$in);
      else if (v && typeof v === 'object' && v.$ne) b = b.neq(f, v.$ne);
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
  async update(collection, query, update) {
    const p = {};
    const d = update.$set || update;
    for (const [k, v] of Object.entries(d)) if (k !== 'id') p[normalizeField(k)] = v;
    const { error } = await supabase.from(collection).update(p).eq('id', query.id || query._id || query.registrationId);
    if (error) throw error;
    return 1;
  }
};
module.exports = db;
