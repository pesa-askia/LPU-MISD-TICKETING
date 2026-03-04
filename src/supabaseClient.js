// Supabase client fallback using REST API
// Uses REST API directly since @supabase/supabase-js is not available

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function buildUrl(path, query) {
    let url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${path}`;
    if (query) url += query;
    return url;
}

function defaultHeaders() {
    return {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
    };
}

function handleResponse(res) {
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok) {
        return res.text().then((text) => {
            try { return Promise.reject(JSON.parse(text)); } catch { return Promise.reject({ status: res.status, message: text }); }
        });
    }
    if (contentType.includes('application/json')) return res.json();
    return res.text();
}

function restFrom(table) {
    let state = { _table: table, _select: '*', _filter: '' };
    return {
        from(tableName) { state._table = tableName; return this; },
        select(sel = '*') { state._select = sel; return this._execSelect(); },
        async _execSelect() {
            // construct query: ?select=... followed by filters
            const q = `?select=${encodeURIComponent(state._select)}` + (state._filter || '');
            const url = buildUrl(state._table, q);
            const res = await fetch(url, { headers: defaultHeaders() });
            return handleResponse(res).then((data) => ({ data, error: null })).catch((error) => ({ data: null, error }));
        },
        insert(rows) { return this._execInsert(rows); },
        async _execInsert(rows) {
            const url = buildUrl(state._table);
            const res = await fetch(url, { method: 'POST', headers: defaultHeaders(), body: JSON.stringify(rows) });
            return handleResponse(res).then((data) => ({ data, error: null })).catch((error) => ({ data: null, error }));
        },
        update(obj) { return this._execUpdate(obj); },
        async _execUpdate(obj) {
            if (!state._filter) return { data: null, error: { message: 'No filter specified for update' } };
            const url = buildUrl(state._table, state._filter);
            const res = await fetch(url, { method: 'PATCH', headers: defaultHeaders(), body: JSON.stringify(obj) });
            return handleResponse(res).then((data) => ({ data, error: null })).catch((error) => ({ data: null, error }));
        },
        delete() { return this._execDelete(); },
        async _execDelete() {
            if (!state._filter) return { data: null, error: { message: 'No filter specified for delete' } };
            const url = buildUrl(state._table, state._filter);
            const res = await fetch(url, { method: 'DELETE', headers: defaultHeaders() });
            return handleResponse(res).then((data) => ({ data, error: null })).catch((error) => ({ data: null, error }));
        },
        eq(field, value) {
            // append filter param in Supabase REST format
            const cond = `${encodeURIComponent(field)}=eq.${encodeURIComponent(value)}`;
            if (!state._filter) state._filter = `&${cond}`; else state._filter += `&${cond}`;
            return this;
        },
        single() { return this._execSelectSingle(); },
        async _execSelectSingle() {
            // For single(), execute the select and return the response structure
            const q = `?select=${encodeURIComponent(state._select)}` + (state._filter || '');
            const url = buildUrl(state._table, q);
            const res = await fetch(url, { headers: defaultHeaders() });
            return handleResponse(res).then((data) => ({ data: data?.[0] || null, error: null })).catch((error) => ({ data: null, error }));
        }
    };
}

// Exported supabase object: uses REST fallback API
export const supabase = {
    from: (table) => restFrom(table),
};

export default supabase;
