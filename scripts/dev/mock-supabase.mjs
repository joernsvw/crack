// Mini-Attrappe von Supabase nur fuer die Browser-Pruefung. Keine echten Daten.
import http from 'node:http'
import { randomUUID as uuid } from 'node:crypto'

const USER = { id: '00000000-0000-0000-0000-00000000000a', email: 'test@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
const OTHER = '00000000-0000-0000-0000-00000000000b'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const db = { taste_profile: [], suggestion_cache: [], suggestion_feedback: [], households: [], household_members: [], shopping_items: [], categories: [], tags: [], recipes: [], recipe_ingredients: [], recipe_tags: [], recipe_ratings: [], cook_history: [], notes: [] }
const now = () => new Date().toISOString()
const defaults = {
  shopping_items: () => ({ id: uuid(), checked: false, checked_at: null, created_by: USER.id, created_at: now(), category: 'Sonstiges' }),
  categories: () => ({ id: uuid(), sort_order: 0 }),
  tags: () => ({ id: uuid() }),
  recipes: () => ({ id: uuid(), created_at: now(), steps: [], created_by: USER.id }),
  recipe_ingredients: () => ({ id: uuid(), sort_order: 0 }),
  recipe_ratings: () => ({ id: uuid(), note: null, modifications: [] }),
  cook_history: () => ({ id: uuid(), cooked_at: now(), cooked_by: USER.id }),
  notes: () => ({ id: uuid(), title: '', preview: '', pinned: false, content: { type: 'doc', content: [{ type: 'paragraph' }] }, updated_by: USER.id, updated_at: now(), created_at: now() }),
}
const pk = { taste_profile: ['household_id'], suggestion_cache: ['household_id'], suggestion_feedback: ['household_id', 'name'], recipe_tags: ['recipe_id', 'tag_id'], recipe_ratings: ['recipe_id', 'user_id'], tags: ['household_id', 'name'] }

function matches(row, params) {
  for (const [k, v] of params) {
    if (['select', 'order', 'on_conflict', 'columns', 'limit'].includes(k)) continue
    if (v.startsWith('eq.') && String(row[k]) !== v.slice(3)) return false
    if (v.startsWith('in.(')) {
      const list = v.slice(4, -1).split(',').map((s) => s.replace(/^"|"$/g, ''))
      if (!list.includes(String(row[k]))) return false
    }
  }
  return true
}
function withRelations(table, row) {
  if (table !== 'recipes') return row
  const by = (t) => db[t].filter((r) => r.recipe_id === row.id)
  return { ...row, recipe_ingredients: by('recipe_ingredients'), recipe_tags: by('recipe_tags'), recipe_ratings: by('recipe_ratings'), cook_history: by('cook_history') }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*')
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] ?? '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Expose-Headers', '*')
  if (req.method === 'OPTIONS') return res.writeHead(204).end()
  const chunks = []
  for await (const c of req) chunks.push(c)
  const raw = Buffer.concat(chunks)
  const body = (() => { try { return JSON.parse(raw.toString()) } catch { return null } })()
  const url = new URL(req.url, 'http://x')
  const send = (code, data) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(data === undefined ? '' : JSON.stringify(data)) }
  const p = url.pathname

  if (p === '/auth/v1/token') {
    if (body?.password !== 'testpass') return send(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' })
    const exp = Math.floor(Date.now() / 1000) + 3600
    return send(200, { access_token: `${b64({ alg: 'HS256' })}.${b64({ sub: USER.id, exp, role: 'authenticated' })}.sig`, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'r', user: USER })
  }
  if (p === '/auth/v1/user') return send(200, USER)
  if (p === '/auth/v1/logout') return send(204)

  if (p === '/rest/v1/rpc/create_household') {
    const id = uuid()
    db.households.push({ id, name: body.household_name, invite_code: 'abc123def456', max_members: 2 })
    db.household_members.push({ household_id: id, user_id: USER.id, display_name: body.member_name, joined_at: now() })
    ;['Abendessen', 'Mittagessen', 'Frühstück', 'Backen', 'Snacks', 'Desserts', 'Getränke'].forEach((name, i) => db.categories.push({ id: uuid(), household_id: id, name, sort_order: i + 1 }))
    return send(200, id)
  }
  if (p === '/__seed_other') {
    // Zweite Person simulieren
    const h = db.households[0]
    db.household_members.push({ household_id: h.id, user_id: OTHER, display_name: 'Zweite Person', joined_at: now() })
    db.shopping_items.push({ ...defaults.shopping_items(), household_id: h.id, name: 'Haferflocken', category: 'Trockenwaren', created_by: OTHER })
    return send(200, {})
  }

  if (p.startsWith('/storage/v1/object/sign/')) return send(200, { signedURL: `/object/sign/x.png?t=1` })
  if (p.startsWith('/storage/v1/object/')) {
    if (req.method === 'DELETE') return send(200, [])
    return send(200, { Id: uuid(), Key: p.replace('/storage/v1/object/', '') })
  }

  if (p === '/functions/v1/import-recipe' && (body?.action === 'suggest' || body?.action === 'leftovers')) {
    await new Promise((r) => setTimeout(r, 300))
    globalThis.lastAction = body
    const mk = (n) => ({ name: n, description: n + ' ist lecker.', why: 'Passt zu euren Curry-Rezepten.', main_ingredients: ['Linsen', 'Kokosmilch'], adaptation: 'geht auch ohne Tomaten' })
    const list = body.action === 'suggest' ? [mk('Dal Makhani'), mk('Paneer Butter Masala')] : [mk('Resteomelett')]
    if (body.action === 'suggest') { const h = db.households[0].id; db.suggestion_cache = [{ household_id: h, suggestions: list, created_at: now() }] }
    return send(200, { suggestions: list })
  }
  if (p === '/__last_action') return send(200, globalThis.lastAction ?? null)
  if (p === '/functions/v1/import-recipe' && body?.action === 'screenshots') {
    await new Promise((r) => setTimeout(r, 300))
    globalThis.lastEdit = { shots: body.screenshots.map((x) => [x.type, x.data.length]) }
    if (body.screenshots.length === 3) return send(422, { error: 'Auf den Bildern wurde kein Rezept erkannt.' })
    const cat = db.categories.find((c) => c.name === 'Backen')
    return send(200, { draft: { title: 'Bananenbrot', description: null, servings: 8, total_minutes: 60, category_id: cat.id, tags: ['süß'],
      ingredients: body.screenshots.length === 2 ? [] : [{ name: 'Mehl', quantity: '2', unit: 'cups', metric: '≈ 240 g' }, { name: 'Butter', quantity: '8', unit: 'oz', metric: '≈ 225 g' }, { name: 'Bananen', quantity: '3', unit: null, metric: null }], steps: ['Backen.'], source_url: null, image_path: null } })
  }
  if (p === '/__last_edit') return send(200, globalThis.lastEdit ?? null)
  if (p === '/functions/v1/import-recipe') {
    await new Promise((r) => setTimeout(r, 400))
    if (body?.recipe_id) {
      globalThis.lastEdit = { instruction: body.instruction, shots: (body.screenshots ?? []).map((s) => [s.type, s.data.length]) }
      if (String(body.instruction).includes('fehler')) return send(429, { error: 'Das Tageslimit für KI-Aufrufe ist erreicht. Morgen geht es weiter.' })
      const old = db.recipes.find((r) => r.id === body.recipe_id)
      return send(200, { draft: {
        title: 'Tikka Masala mit Halloumi', description: old.description, servings: old.servings, total_minutes: 25, category_id: old.category_id,
        tags: ['schnell'], ingredients: [{ name: 'Halloumi', quantity: '400', unit: 'g' }, { name: 'Tomaten', quantity: '3', unit: null }],
        steps: ['Halloumi anbraten.', 'Soße zubereiten.'], source_url: old.source_url, image_path: old.image_path,
      } })
    }
    if (String(body?.url).includes('fehler')) return send(422, { error: 'Diese Seite lässt sich nicht automatisch auslesen.' })
    const leer = String(body?.url).includes('leer')
    const cat = db.categories.find((c) => c.name === 'Abendessen')
    return send(200, { draft: {
      title: 'Cremige Tomatenpasta', description: 'Schnelle Pasta für den Feierabend.', servings: 2, total_minutes: 20,
      category_id: cat?.id ?? null, tags: ['schnell', 'vegetarisch'],
      ingredients: leer ? [] : [{ name: 'Nudeln', quantity: '200', unit: 'g' }, { name: 'Tomaten', quantity: '3', unit: null }],
      steps: leer ? [] : ['Nudeln kochen.', 'Soße zubereiten.'],
      source_url: body.url, image_path: `${db.households[0]?.id}/import-x.jpg`,
    } })
  }
  const m = /^\/rest\/v1\/(\w+)$/.exec(p)
  if (!m || !db[m[1]]) return send(404, { message: 'not found: ' + p })
  const table = m[1]
  const rows = db[table]
  const params = [...url.searchParams.entries()]
  const single = (req.headers.accept ?? '').includes('vnd.pgrst.object')
  const wantRep = (req.headers.prefer ?? '').includes('return=representation')

  if (req.method === 'GET') {
    let out = rows.filter((r) => matches(r, params)).map((r) => withRelations(table, r))
    const order = url.searchParams.get('order')
    if (order) {
      const [col, dir] = order.split('.')
      out = [...out].sort((a, b) => String(a[col]).localeCompare(String(b[col]), undefined, { numeric: true }) * (dir === 'desc' ? -1 : 1))
    }
    if (single) return out[0] ? send(200, out[0]) : send(406, { code: 'PGRST116', message: 'no rows' })
    return send(200, out)
  }
  if (req.method === 'POST') {
    const list = Array.isArray(body) ? body : [body]
    const merge = (req.headers.prefer ?? '').includes('merge-duplicates')
    const ignore = (req.headers.prefer ?? '').includes('ignore-duplicates')
    const created = []
    for (const r of list) {
      const keys = pk[table] ?? ['id']
      const existing = rows.find((o) => keys.every((k) => r[k] !== undefined && o[k] === r[k]))
      if (existing) {
        if (ignore) continue
        if (merge) { Object.assign(existing, r); created.push(existing); continue }
        return send(409, { code: '23505', message: 'duplicate' })
      }
      const row = { ...(defaults[table]?.() ?? {}), ...r }
      if (table === 'recipe_ratings' && !row.user_id) row.user_id = USER.id
      rows.push(row)
      created.push(row)
    }
    if (!wantRep) return send(201)
    return send(201, single ? created[0] : created)
  }
  if (req.method === 'PATCH') {
    for (const r of rows.filter((x) => matches(x, params))) {
      Object.assign(r, body)
      if (table === 'notes' && ('content' in body)) { r.updated_at = now(); r.updated_by = USER.id }
    }
    return send(204)
  }
  if (req.method === 'DELETE') {
    db[table] = rows.filter((r) => !matches(r, params))
    if (table === 'recipes') for (const t of ['recipe_ingredients', 'recipe_tags', 'recipe_ratings', 'cook_history']) db[t] = db[t].filter((r) => db.recipes.some((x) => x.id === r.recipe_id))
    return send(204)
  }
  send(405, {})
})
server.listen(54399, () => console.log('mock on 54399'))
