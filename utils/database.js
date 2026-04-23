const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Supabase configuration is missing. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const normalizeField = key => {
  if (key === '_id' || key === 'id') return 'id';
  const manualMap = {
    eventId: 'eventid',
    registrationId: 'registrationid',
    roleId: 'roleid'
  };
  return manualMap[key] || key.toLowerCase(); 
};

const mapRecord = record => {
  if (!record) return null;
  
  const fieldMap = {
    eventid: 'eventId',
    endtime: 'endTime',
    participantlimit: 'participantLimit',
    volunteerroles: 'volunteerRoles',
    issupportiveteam: 'isSupportiveTeam',
    teammode: 'teamMode',
    teamsize: 'teamSize',
    signupurl: 'signupUrl',
    qrcode: 'qrCode',
    createdat: 'createdAt',
    createdby: 'createdBy',
    updatedat: 'updatedAt',
    registrationid: 'registrationId',
    registeredat: 'registeredAt',
    roleid: 'roleId',
    rolename: 'roleName',
    teamname: 'teamName',
    teammembers: 'teamMembers',
    hoursvolunteered: 'hoursVolunteered',
    swaprequested: 'swapRequested',
    swaprequestedroleid: 'swapRequestedRoleId',
    swapreason: 'swapReason',
    swaprequestedat: 'swapRequestedAt',
    swaprequestednewemail: 'swapRequestedNewEmail',
    swaprequestednewname: 'swapRequestedNewName',
    swaprequestednewusn: 'swapRequestedNewUsn',
    swapapprovedat: 'swapApprovedAt',
    swaprejectedat: 'swapRejectedAt',
    checkedin: 'checkedIn',
    checkinat: 'checkinAt',
    approvedat: 'approvedAt',
    rejectedat: 'rejectedAt',
    cancelledat: 'cancelledAt',
    noshow: 'noShow',
    certid: 'certId',
    academicyear: 'academicYear',
    sentat: 'sentAt',
    expiresat: 'expiresAt',
    secretcode: 'secretCode',
    displayname: 'displayName',
    photourl: 'photoURL',
    registrationstatus: 'registrationStatus',
    registrationdeadline: 'registrationDeadline',
    isoutside: 'isOutside',
    venue: 'venue',
    image: 'image',
    ispast: 'isPast'
  };

  const mapped = {};
  for (const [key, value] of Object.entries(record)) {
    const appKey = fieldMap[key.toLowerCase()] || key;
    let finalValue = value;
    
    // Normalize boolean-like values for known boolean fields
    if (['isSupportiveTeam', 'checkedIn', 'noShow', 'swapRequested'].includes(appKey)) {
      finalValue = (value === true || value === 'true');
    }

    if (appKey.toLowerCase() === 'id') {
      mapped._id = finalValue;
      mapped.id = finalValue;
    } else {
      mapped[appKey] = finalValue;
    }
  }
  return mapped;
};

const db = {
  async refreshSchema() {
    try {
      await supabase.rpc('exec_sql', { sql: "NOTIFY pgrst, 'reload schema';" });
    } catch (e) {}
  },

  async findOne(collection, query) {
    const docs = await this.find(collection, query);
    return docs.length > 0 ? docs[0] : null;
  },

  async find(collection, query = {}, sort = {}) {
    let builder = supabase.from(collection).select('*');
    const regexFilters = [];
    
    for (const [key, value] of Object.entries(query)) {
      if (value instanceof RegExp) {
        regexFilters.push({ key, value });
        continue;
      }
      
      const field = normalizeField(key);
      if (key === '$or' && Array.isArray(value)) {
        const orConditions = value.map(cond => {
          const [subKey, subVal] = Object.entries(cond)[0];
          const subField = normalizeField(subKey);
          if (typeof subVal === 'object' && subVal !== null) {
            if (subVal.$ne !== undefined) return `${subField}.neq.${subVal.$ne}`;
            if (subVal.$eq !== undefined) return `${subField}.eq.${subVal.$eq}`;
            return `${subField}.eq.${subVal}`;
          }
          return `${subField}.eq.${subVal}`;
        }).join(',');
        builder = builder.or(orConditions);
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        if (value.$ne !== undefined) builder = builder.not(field, 'eq', value.$ne);
        else if (value.$in !== undefined) builder = builder.in(field, value.$in);
        else if (value.$gt !== undefined) builder = builder.gt(field, value.$gt);
        else if (value.$lt !== undefined) builder = builder.lt(field, value.$lt);
        else if (value.$gte !== undefined) builder = builder.gte(field, value.$gte);
        else if (value.$lte !== undefined) builder = builder.lte(field, value.$lte);
        else builder = builder.eq(field, value);
      } else {
        builder = builder.eq(field, value);
      }
    }

    for (const [key, direction] of Object.entries(sort)) {
      builder = builder.order(normalizeField(key), { ascending: direction !== -1 });
    }

    const { data, error } = await builder;
    let results = [];
    if (error) {
      console.error(`❌ [DB Error] collection=${collection} error=${error.message} code=${error.code}`);
      if (error.message.includes('column') || error.message.includes('cache')) {
        console.warn(`[DB Warning] Schema cache error detected for ${collection}. Attempting reload...`);
        await this.refreshSchema();
        // Wait a bit for reload
        await new Promise(r => setTimeout(r, 200));
        const { data: retryData, error: retryError } = await supabase.from(collection).select('*');
        if (retryError) throw retryError;
        results = (retryData || []).map(mapRecord);
      } else {
        throw error;
      }
    } else {
      results = (data || []).map(mapRecord);
    }

    // Apply regex filters in memory
    if (regexFilters.length > 0) {
      for (const { key, value } of regexFilters) {
        results = results.filter(doc => doc[key] && value.test(doc[key]));
      }
    }

    return results;
  },

  async insert(collection, doc) {
    const payload = {};
    for (const [k, v] of Object.entries(doc)) {
      payload[normalizeField(k)] = v;
    }
    
    if (!payload.id) payload.id = uuidv4();
    console.log(`[DB Debug] Inserting into ${collection} with payload keys:`, Object.keys(payload));

    try {
      const { data, error } = await supabase.from(collection).insert(payload).select();
      if (error) {
        console.error(`❌ [DB Error] collection=${collection} error=${error.message} code=${error.code} details=${error.details}`);
        if (error.message.includes('column') || error.message.includes('cache')) {
          console.log('[DB Info] Column error detected, refreshing schema...');
          await this.refreshSchema();
          await new Promise(r => setTimeout(r, 200));
          const { data: retryData, error: retryError } = await supabase.from(collection).insert(payload).select();
          if (retryError) {
            const err = new Error(retryError.message);
            err.code = retryError.code;
            err.details = retryError.details;
            throw err;
          }
          return mapRecord(retryData ? retryData[0] : payload);
        }
        const err = new Error(error.message);
        err.code = error.code;
        err.details = error.details;
        throw err;
      }
      return mapRecord(data && data.length > 0 ? data[0] : payload);
    } catch (unexpectedErr) {
      console.error(`❌ [DB Unexpected Error] ${unexpectedErr.message}`);
      throw unexpectedErr;
    }
  },

  async update(collection, query, update, options = {}) {
    const updateData = update.$set || update;
    const payload = {};
    for (const [k, v] of Object.entries(updateData)) {
      if (k !== '_id' && k !== 'id') payload[normalizeField(k)] = v;
    }

    let targetId = query._id || query.id;
    if (targetId) {
      const { error } = await supabase.from(collection).update(payload).eq('id', targetId);
      if (error) {
        if (error.message.includes('column') || error.message.includes('cache')) {
          await this.refreshSchema();
          await new Promise(r => setTimeout(r, 200));
          const { error: retryError } = await supabase.from(collection).update(payload).eq('id', targetId);
          if (retryError) throw retryError;
          return 1;
        }
        throw error;
      }
      return 1;
    }

    const docs = await this.find(collection, query);
    for (const doc of docs) {
      const { error } = await supabase.from(collection).update(payload).eq('id', doc._id);
      if (error && (error.message.includes('column') || error.message.includes('cache'))) {
         await this.refreshSchema();
         await new Promise(r => setTimeout(r, 200));
         await supabase.from(collection).update(payload).eq('id', doc._id);
      } else if (error) throw error;
    }
    return docs.length;
  },

  async remove(collection, query) {
    let targetId = query._id || query.id;
    if (targetId) {
      const { error } = await supabase.from(collection).delete().eq('id', targetId);
      if (error) {
         if (error.message.includes('column') || error.message.includes('cache')) {
            await this.refreshSchema();
            await new Promise(r => setTimeout(r, 200));
            const { error: retryError } = await supabase.from(collection).delete().eq('id', targetId);
            if (retryError) throw retryError;
            return 1;
         }
         throw error;
      }
      return 1;
    }
    const docs = await this.find(collection, query);
    for (const doc of docs) {
      const { error } = await supabase.from(collection).delete().eq('id', doc._id);
      if (error && (error.message.includes('column') || error.message.includes('cache'))) {
         await this.refreshSchema();
         await new Promise(r => setTimeout(r, 200));
         await supabase.from(collection).delete().eq('id', doc._id);
      } else if (error) throw error;
    }
    return docs.length;
  },

  async count(collection, query) {
    let builder = supabase.from(collection).select('*', { count: 'exact', head: true });
    
    for (const [key, value] of Object.entries(query)) {
      const field = normalizeField(key);
      if (key === '$or' && Array.isArray(value)) {
        const orConditions = value.map(cond => {
          const [subKey, subVal] = Object.entries(cond)[0];
          const subField = normalizeField(subKey);
          if (typeof subVal === 'object' && subVal !== null) {
            if (subVal.$ne !== undefined) return `${subField}.neq.${subVal.$ne}`;
            if (subVal.$eq !== undefined) return `${subField}.eq.${subVal.$eq}`;
            return `${subField}.eq.${subVal}`;
          }
          return `${subField}.eq.${subVal}`;
        }).join(',');
        builder = builder.or(orConditions);
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        if (value.$ne !== undefined) builder = builder.not(field, 'eq', value.$ne);
        else if (value.$in !== undefined) builder = builder.in(field, value.$in);
        else if (value.$gt !== undefined) builder = builder.gt(field, value.$gt);
        else if (value.$lt !== undefined) builder = builder.lt(field, value.$lt);
        else if (value.$gte !== undefined) builder = builder.gte(field, value.$gte);
        else if (value.$lte !== undefined) builder = builder.lte(field, value.$lte);
        else builder = builder.eq(field, value);
      } else {
        builder = builder.eq(field, value);
      }
    }

    const { count, error } = await builder;
    if (error) throw error;
    return count || 0;
  }
};

module.exports = db;
