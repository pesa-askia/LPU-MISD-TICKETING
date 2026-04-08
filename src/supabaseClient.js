// Supabase client fallback using REST API
// Uses REST API directly since @supabase/supabase-js is not available

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
    console.error('Missing Supabase environment variables:', {
        VITE_SUPABASE_URL: SUPABASE_URL ? '✓' : '✗',
        VITE_SUPABASE_ANON_KEY: ANON_KEY ? '✓' : '✗'
    });
    throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'N/A';
    const supa = (() => { try { return new URL(SUPABASE_URL).origin; } catch { return SUPABASE_URL; } })();
    const isLocal = typeof window !== 'undefined' && (location.hostname === 'localhost' || location.hostname.startsWith('127.'));
    const env = isLocal ? 'local' : 'hosted';
    console.log(`[Frontend] ${env} base: ${base} • Supabase: ${supa}`);
} catch { }

function buildUrl(path, query) {
    if (!SUPABASE_URL) {
        throw new Error('SUPABASE_URL is not defined. Please set VITE_SUPABASE_URL in your environment variables.');
    }
    if (!path) {
        throw new Error('Table path is required for buildUrl');
    }
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
    let state = { _table: table, _select: '*', _filter: '', _order: '' };
    const chain = {
        from(tableName) { state._table = tableName; return chain; },
        select(sel = '*') { state._select = sel; return chain; },
        async _execSelect() {
            // construct query: ?select=... followed by filters and order
            let q = `?select=${encodeURIComponent(state._select)}`;
            if (state._filter) q += state._filter;
            if (state._order) q += state._order;
            const url = buildUrl(state._table, q);
            const res = await fetch(url, { headers: defaultHeaders() });
            return handleResponse(res).then((data) => ({ data, error: null })).catch((error) => ({ data: null, error }));
        },
        // Make chain awaitable
        then(resolve, reject) {
            return chain._execSelect().then(resolve, reject);
        },
        catch(reject) {
            return chain._execSelect().catch(reject);
        },
        insert(rows) { return chain._execInsert(rows); },
        async _execInsert(rows) {
            const url = buildUrl(state._table);
            const res = await fetch(url, { method: 'POST', headers: defaultHeaders(), body: JSON.stringify(rows) });
            return handleResponse(res).then((data) => ({ data, error: null })).catch((error) => ({ data: null, error }));
        },
        update(obj) { return chain._execUpdate(obj); },
        async _execUpdate(obj) {
            if (!state._filter) return { data: null, error: { message: 'No filter specified for update' } };
            // state._filter holds something like "&id=eq.123" – convert to proper query
            let q = state._filter || "";
            if (q.startsWith("&")) q = q.slice(1);
            if (!q.startsWith("?")) q = `?${q}`;
            const url = buildUrl(state._table, q);
            const res = await fetch(url, { method: 'PATCH', headers: defaultHeaders(), body: JSON.stringify(obj) });
            return handleResponse(res).then((data) => ({ data, error: null })).catch((error) => ({ data: null, error }));
        },
        delete() { return chain._execDelete(); },
        async _execDelete() {
            if (!state._filter) return { data: null, error: { message: 'No filter specified for delete' } };
            let q = state._filter || "";
            if (q.startsWith("&")) q = q.slice(1);
            if (!q.startsWith("?")) q = `?${q}`;
            const url = buildUrl(state._table, q);
            const res = await fetch(url, { method: 'DELETE', headers: defaultHeaders() });
            return handleResponse(res).then((data) => ({ data, error: null })).catch((error) => ({ data: null, error }));
        },
        eq(field, value) {
            // append filter param in Supabase REST format
            const cond = `${encodeURIComponent(field)}=eq.${encodeURIComponent(value)}`;
            if (!state._filter) state._filter = `&${cond}`; else state._filter += `&${cond}`;
            return chain;
        },
        order(column, options = {}) {
            // append order param in Supabase REST format
            const ascending = options.ascending !== false ? 'asc' : 'desc';
            const cond = `&order=${encodeURIComponent(column)}.${ascending}`;
            state._order = cond;
            return chain;
        },
        single() { return chain._execSelectSingle(); },
        async _execSelectSingle() {
            // For single(), execute the select and return the response structure
            let q = `?select=${encodeURIComponent(state._select)}`;
            if (state._filter) q += state._filter;
            if (state._order) q += state._order;
            const url = buildUrl(state._table, q);
            const res = await fetch(url, { headers: defaultHeaders() });
            return handleResponse(res).then((data) => ({ data: data?.[0] || null, error: null })).catch((error) => ({ data: null, error }));
        }
    };
    return chain;
}

// Exported supabase object: uses REST fallback API
export const supabase = {
    from: (table) => restFrom(table),
};

export default supabase;
