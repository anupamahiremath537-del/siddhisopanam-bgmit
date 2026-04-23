const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const normalizeField = key => {
  if (key === '_id' || key === 'id') return 'id';
  const manualMap = { eventId: 'eventid', registrationId: 'registrationid', roleId: 'roleid' };
  return manualMap[key] || key.toLowerCase(); 
};

const mapRecord = record => {
  if (!record) return null;
  const fieldMap = {
    eventid: 'eventId', endtime: 'endTime', participantlimit: 'participantLimit', 
    volunteerroles: 'volunteerRoles', issupportiveteam: 'isSupportiveTeam',
    registrationid: 'registrationId', registeredat: 'registeredAt', 
    checkedin: 'checkedIn', checkinat: 'checkinAt'
  };
  const mapped = {};
  for (const [key, value] of Object.entries(record)) {
    const appKey = fieldMap[key.toLowerCase()] || key;
    let finalValue = value;
    if (['isSupportiveTeam', 'checkedIn', 'noShow', 'swapRequested'].includes(appKey)) {
      finalValue = (value === true || value === 'true');
    }
    mapped[appKey] = finalValue;
    if (appKey.toLowerCase() === 'id') { mapped._id = finalValue; mapped.id = finalValue; }
  }
  return mapped;
};

const db = {
  // Added back to prevent server.js crashes
  async refreshSchema() {
    try {
      await supabase.rpc('exec_sql', { sql: "NOTIFY pgrst, 'reload schema';" }).catch(() => {});
    } catch (e) {}
  },

  async findOne(collection, query, options = {}) {
    const docs = await this.find(collection, query, { ...options, limit: 1 });
    return docs.length > 0 ? docs[0] : null;
  },

  async find(collection, query = {}, options = {}) {
    const normQuery = {};
    for (const [k, v] of Object.entries(query)) normQuery[normalizeField(k)] = v;

    let selectStr = options.select || '*';
    if (collection === 'registrations' && selectStr.includes('*') && !normQuery.id && !normQuery.registrationid) {
      selectStr = 'id,eventid,registrationid,name,email,phone,usn,type,roleid,rolename,teamname,status,checkedin,registeredat';
    }

    let retries = 0;
    while (retries < 3) {
      try {
        let builder = supabase.from(collection).select(selectStr);
        
        for (const [field, value] of Object.entries(normQuery)) {
          // RESTORE $OR SUPPORT
          if (field === '$or' && Array.isArray(value)) {
            const orStr = value.map(cond => {
              const [k, v] = Object.entries(cond)[0];
              const f = normalizeField(k);
              if (v === null) return `${f}.is.null`;
              if (typeof v === 'boolean') return `${f}.eq.${v}`;
              return `${f}.eq."${v}"`; // Quote strings
            }).join(',');
            builder = builder.or(orStr);
          } 
          else if (value && typeof value === 'object') {
            if (value.$in) builder = builder.in(field, value.$in);
            else if (value.$ne) {
              if (value.$ne === null) builder = builder.not(field, 'is', null);
              else builder = builder.neq(field, value.$ne);
            }
            else builder = builder.eq(field, value);
          } else {
            if (value === null) builder = builder.is(field, null);
            else builder = builder.eq(field, value);
          }
        }

        if (options.sort) {
          for (const [k, v] of Object.entries(options.sort)) builder = builder.order(normalizeField(k), { ascending: v !== -1 });
        }
        if (options.limit) builder = builder.range(options.skip || 0, (options.skip || 0) + options.limit - 1);

        const { data, error } = await builder;
        if (error) throw error;
        return (data || []).map(mapRecord);
      } catch (err) {
        retries++;
        if (retries >= 3) throw err;
        await new Promise(r => setTimeout(r, 1000 * retries));
      }
    }
  },

  async count(collection, query) {
    const normQuery = {};
    for (const [k, v] of Object.entries(query)) normQuery[normalizeField(k)] = v;
    let builder = supabase.from(collection).select('*', { count: 'exact', head: true });
    for (const [field, value] of Object.entries(normQuery)) {
      if (field === '$or' && Array.isArray(value)) {
        const orStr = value.map(cond => {
          const [k, v] = Object.entries(cond)[0];
          const f = normalizeField(k);
          if (v === null) return `${f}.is.null`;
          if (typeof v === 'boolean') return `${f}.eq.${v}`;
          return `${f}.eq."${v}"`;
        }).join(',');
        builder = builder.or(orStr);
      }
      else if (value && typeof value === 'object') {
        if (value.$ne) {
          if (value.$ne === null) builder = builder.not(field, 'is', null);
          else builder = builder.neq(field, value.$ne);
        }
        else if (value.$in) builder = builder.in(field, value.$in);
        else builder = builder.eq(field, value);
      }
      else {
        if (value === null) builder = builder.is(field, null);
        else builder = builder.eq(field, value);
      }
    }
    const { count, error } = await builder;
    if (error) return 0;
    return count || 0;
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
    const data = update.$set || update;
    for (const [k, v] of Object.entries(data)) if (k !== 'id') p[normalizeField(k)] = v;
    const targetId = query.id || query._id || query.registrationId || query.registrationid;
    const { error } = await supabase.from(collection).update(p).eq('id', targetId);
    if (error) throw error;
    return 1;
  }
};

module.exports = db;
