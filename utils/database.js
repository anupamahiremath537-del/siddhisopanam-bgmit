const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Supabase configuration is missing. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY in your environment.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const normalizeField = key => {
  if (key === '_id') return 'id';
  return key; 
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
    photourl: 'photoURL'
  };

  const mapped = {};
  for (const [key, value] of Object.entries(record)) {
    const appKey = fieldMap[key.toLowerCase()] || key;
    if (appKey.toLowerCase() === 'id') {
      mapped._id = value;
      mapped.id = value;
    } else {
      mapped[appKey] = value;
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
      
      const field = key === '_id' ? 'id' : key;
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
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
      builder = builder.order(key === '_id' ? 'id' : key, { ascending: direction !== -1 });
    }

    const { data, error } = await builder;
    let results = [];
    if (error) {
      if (error.message.includes('column') || error.message.includes('cache')) {
        const { data: allData, error: allError } = await supabase.from(collection).select('*');
        if (allError) throw allError;
        results = allData.map(mapRecord);
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
    for (const [k, v] of Object.entries(doc)) payload[k] = v;
    if (payload._id) { payload.id = payload._id; delete payload._id; }
    if (!payload.id) payload.id = uuidv4();

    const { data, error } = await supabase.from(collection).insert(payload).select();
    if (error) {
      const { error: retryError } = await supabase.from(collection).insert(payload);
      if (retryError) throw retryError;
      return { ...doc, id: payload.id, _id: payload.id };
    }
    return mapRecord(data ? data[0] : payload);
  },

  async update(collection, query, update, options = {}) {
    const updateData = update.$set || update;
    const payload = {};
    for (const [k, v] of Object.entries(updateData)) {
      if (k !== '_id') payload[k] = v;
    }

    let targetId = query._id || query.id;
    if (targetId) {
      const { error } = await supabase.from(collection).update(payload).eq('id', targetId);
      if (error) throw error;
      return 1;
    }

    const docs = await this.find(collection, query);
    for (const doc of docs) {
      await supabase.from(collection).update(payload).eq('id', doc._id);
    }
    return docs.length;
  },

  async remove(collection, query) {
    let targetId = query._id || query.id;
    if (targetId) {
      const { error } = await supabase.from(collection).delete().eq('id', targetId);
      if (error) throw error;
      return 1;
    }
    const docs = await this.find(collection, query);
    for (const doc of docs) {
      await supabase.from(collection).delete().eq('id', doc._id);
    }
    return docs.length;
  },

  async count(collection, query) {
    const docs = await this.find(collection, query);
    return docs.length;
  }
};

module.exports = db;
