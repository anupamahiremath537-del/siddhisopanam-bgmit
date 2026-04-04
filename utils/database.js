const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Supabase configuration is missing. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY in your environment.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const normalizeField = key => key === '_id' ? 'id' : key;
const mapRecord = record => {
  if (!record) return null;
  const { id, ...rest } = record;
  return { _id: id, ...rest };
};

const buildQuery = (collection, query = {}) => {
  let builder = supabase.from(collection).select('*');
  const regexFilters = [];
  const jsFilters = [];

  for (const [key, value] of Object.entries(query)) {
    const field = normalizeField(key);

    if (value instanceof RegExp) {
      regexFilters.push({ key, value });
      continue;
    }

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      if (value.$ne !== undefined) {
        builder = builder.not(`${field}.eq.${value.$ne}`);
      } else if (value.$in !== undefined) {
        builder = builder.in(field, value.$in);
      } else if (value.$gt !== undefined) {
        builder = builder.gt(field, value.$gt);
      } else if (value.$lt !== undefined) {
        builder = builder.lt(field, value.$lt);
      } else if (value.$gte !== undefined) {
        builder = builder.gte(field, value.$gte);
      } else if (value.$lte !== undefined) {
        builder = builder.lte(field, value.$lte);
      } else {
        builder = builder.eq(field, value);
      }
    } else {
      builder = builder.eq(field, value);
    }
  }

  return { builder, regexFilters, jsFilters };
};

const runQuery = async (builder, regexFilters, jsFilters, sort = {}) => {
  const { data, error } = await builder;
  if (error) {
    console.error(`❌ Supabase query error:`, error.message);
    throw error;
  }

  let results = (data || []).map(mapRecord);

  for (const { key, value } of regexFilters) {
    results = results.filter(doc => value.test(doc[key]));
  }

  for (const filterFn of jsFilters) {
    results = results.filter(filterFn);
  }

  const sortEntries = Object.entries(sort);
  if (sortEntries.length > 0) {
    results.sort((a, b) => {
      for (const [key, direction] of sortEntries) {
        const valA = a[key];
        const valB = b[key];
        if (valA < valB) return direction === -1 ? 1 : -1;
        if (valA > valB) return direction === -1 ? -1 : 1;
      }
      return 0;
    });
  }

  return results;
};

const applyUpdatePayload = (existing, update) => {
  let updateData = update.$set || update;

  if (update.$push) {
    updateData = { ...updateData };
    for (const [key, val] of Object.entries(update.$push)) {
      const current = Array.isArray(existing[key]) ? existing[key] : [];
      const next = Array.isArray(val) ? [...current, ...val] : [...current, val];
      updateData[key] = Array.from(new Set(next));
    }
  }

  return updateData;
};

const db = {
  async findOne(collection, query) {
    const docs = await this.find(collection, query);
    return docs.length > 0 ? docs[0] : null;
  },

  async find(collection, query = {}, sort = {}) {
    const { builder, regexFilters, jsFilters } = buildQuery(collection, query);
    const allSortKeys = Object.entries(sort);
    for (const [key, direction] of allSortKeys) {
      builder.order(normalizeField(key), { ascending: direction !== -1 });
    }

    try {
      return await runQuery(builder, regexFilters, jsFilters, sort);
    } catch (error) {
      if (regexFilters.length || jsFilters.length) {
        const { data, error: fallbackError } = await supabase.from(collection).select('*');
        if (fallbackError) {
          console.error('❌ Supabase fallback error:', fallbackError.message);
          return [];
        }
        let results = (data || []).map(mapRecord);
        for (const { key, value } of regexFilters) {
          results = results.filter(doc => value.test(doc[key]));
        }
        for (const filterFn of jsFilters) {
          results = results.filter(filterFn);
        }
        const sortEntries = Object.entries(sort);
        if (sortEntries.length > 0) {
          results.sort((a, b) => {
            for (const [key, direction] of sortEntries) {
              const valA = a[key];
              const valB = b[key];
              if (valA < valB) return direction === -1 ? 1 : -1;
              if (valA > valB) return direction === -1 ? -1 : 1;
            }
            return 0;
          });
        }
        return results;
      }
      return [];
    }
  },

  async insert(collection, doc) {
    const payload = { ...doc };
    if (payload._id) {
      payload.id = payload._id;
      delete payload._id;
    }

    const { data, error } = await supabase.from(collection).insert(payload).select().single();
    if (error) {
      console.error(`❌ Supabase insert error:`, error.message);
      throw error;
    }
    return mapRecord(data);
  },

  async update(collection, query, update, options = {}) {
    if (query._id || query.id) {
      const targetId = query._id || query.id;
      const existing = await this.findOne(collection, { _id: targetId });
      if (!existing) return 0;
      const updateData = applyUpdatePayload(existing, update);
      const { error } = await supabase.from(collection).update(updateData).eq('id', targetId);
      if (error) {
        console.error(`❌ Supabase update error:`, error.message);
        throw error;
      }
      return 1;
    }

    const docs = await this.find(collection, query);
    let count = 0;
    for (const doc of docs) {
      const updateData = applyUpdatePayload(doc, update);
      const { error } = await supabase.from(collection).update(updateData).eq('id', doc._id);
      if (error) {
        console.error(`❌ Supabase update error:`, error.message);
        throw error;
      }
      count++;
      if (!options.multi) break;
    }
    return count;
  },

  async remove(collection, query, options = {}) {
    if (query._id || query.id) {
      const targetId = query._id || query.id;
      const { error } = await supabase.from(collection).delete().eq('id', targetId);
      if (error) {
        console.error(`❌ Supabase delete error:`, error.message);
        throw error;
      }
      return 1;
    }

    const docs = await this.find(collection, query);
    let count = 0;
    for (const doc of docs) {
      const { error } = await supabase.from(collection).delete().eq('id', doc._id);
      if (error) {
        console.error(`❌ Supabase delete error:`, error.message);
        throw error;
      }
      count++;
      if (!options.multi) break;
    }
    return count;
  },

  async count(collection, query) {
    const docs = await this.find(collection, query);
    return docs.length;
  }
};

module.exports = db;
