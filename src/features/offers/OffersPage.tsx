import { useMemo, useRef, useState, type FormEvent } from 'react'
import { CalendarRange, FileUp, ImageOff, RefreshCw, Search, Sparkles, Store, Tag, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorBox, PageHeader, Sheet, Spinner } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useHousehold } from '../../context/HouseholdContext'
import { readCache, writeCache } from '../../lib/cache'
import type { Ingredient, Offer, Prospect } from '../../lib/types'
import { useCachedSuggestions } from '../discover/data'
import { AddToShoppingSheet } from '../recipes/AddToShoppingSheet'
import { useImageUrl, useRecipes } from '../recipes/data'
import { StarsDisplay } from '../recipes/Stars'
import { useShopping } from '../shopping/useShopping'
import { deleteProspect, startReading, STORES, updateValidity, uploadProspect, useOffers, useProspects } from './data'
import { activeOffers, compareShoppingList, formatPrice, isoDay, nextMonday, scanRecipes, type OfferMatch } from './match'
import { weekPlan, type PlanEntry } from './weekPlan'

type OffersTab = 'prospects' | 'recipes' | 'shopping'
type Week = 'this' | 'next'

interface Prefs {
  tab: OffersTab
  week: Week
}

const TABS: { value: OffersTab; label: string }[] = [
  { value: 'prospects', label: 'Prospekte' },
  { value: 'recipes', label: 'Eure Gerichte' },
  { value: 'shopping', label: 'Einkaufsliste' },
]

function formatDay(day: string | null) {
  if (!day) return null
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year, month - 1, date).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' })
}

function validityText(from: string | null, to: string | null) {
  if (from && to) return `${formatDay(from)} bis ${formatDay(to)}`
  if (from) return `ab ${formatDay(from)}`
  if (to) return `bis ${formatDay(to)}`
  return 'Gültigkeit unbekannt'
}

export function OffersPage() {
  const { user } = useAuth()
  const { householdId } = useHousehold()
  const prospects = useProspects(householdId)
  const offers = useOffers(householdId)
  const [prefs, setPrefs] = useState<Prefs>(() => ({ tab: 'prospects', week: 'this', ...readCache<Prefs>('offers-prefs') }))
  const [planOpen, setPlanOpen] = useState(false)

  const update = (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    writeCache('offers-prefs', next)
  }

  // Realtime meldet Aenderungen sonst auch, das hier macht es nach eigenen Aktionen sofort sichtbar.
  const reload = () => {
    void prospects.refresh()
    void offers.refresh()
  }

  const day = prefs.week === 'this' ? isoDay(new Date()) : isoDay(nextMonday())
  const active = useMemo(() => activeOffers(offers.data ?? [], prospects.data ?? [], day), [offers.data, prospects.data, day])

  return (
    <div className="pb-10">
      <PageHeader
        title="Angebote"
        back="/einkauf"
        actions={
          <button className="btn btn-soft h-10 !px-3 text-sm" onClick={() => setPlanOpen(true)}>
            <Sparkles size={16} aria-hidden /> Wochenplan (Test)
          </button>
        }
      />
      <main className="mx-auto max-w-2xl space-y-3 px-4">
        <div className="grid grid-cols-3 gap-2" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              role="tab"
              aria-selected={prefs.tab === tab.value}
              className={`chip justify-center !px-2 ${prefs.tab === tab.value ? 'chip-active' : ''}`}
              onClick={() => update({ tab: tab.value })}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CalendarRange size={18} className="text-muted" aria-hidden />
          {(
            [
              ['this', 'Diese Woche'],
              ['next', 'Nächste Woche'],
            ] as const
          ).map(([week, label]) => (
            <button key={week} className={`chip ${prefs.week === week ? 'chip-active' : ''}`} aria-pressed={prefs.week === week} onClick={() => update({ week })}>
              {label}
            </button>
          ))}
          <span className="text-sm text-muted">{active.length} Angebote gültig</span>
        </div>

        {(prospects.error || offers.error) && <ErrorBox message={prospects.error ?? offers.error ?? ''} onRetry={() => void prospects.refresh()} />}

        {prospects.loading && !prospects.data ? (
          <Spinner />
        ) : prefs.tab === 'prospects' ? (
          <ProspectsTab householdId={householdId} prospects={prospects.data ?? []} offers={offers.data ?? []} day={day} onChanged={reload} />
        ) : prefs.tab === 'recipes' ? (
          <RecipesTab householdId={householdId} userId={user!.id} offers={active} />
        ) : (
          <ShoppingTab householdId={householdId} userId={user!.id} offers={active} />
        )}
      </main>

      {planOpen && <WeekPlanSheet householdId={householdId} userId={user!.id} offers={active} onClose={() => setPlanOpen(false)} />}
    </div>
  )
}

function NoOffers({ week }: { week?: boolean }) {
  return (
    <EmptyState
      icon={Tag}
      title="Keine Angebote für diese Woche"
      text={week ? 'Lade unter „Prospekte“ ein PDF hoch, zum Beispiel aus der App oder von der Seite des Markts.' : undefined}
    />
  )
}

/* ------------------------------------------------------------------ Prospekte */

function ProspectsTab({ householdId, prospects, offers, day, onChanged }: { householdId: string; prospects: Prospect[]; offers: Offer[]; day: string; onChanged: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null)
  return (
    <div className="space-y-3">
      <UploadForm householdId={householdId} onUploaded={onChanged} />
      {prospects.length === 0 ? (
        <EmptyState icon={FileUp} title="Noch keine Prospekte" text="Lade das PDF eines Prospekts hoch. Die KI liest die Angebote aus, das dauert ein bis drei Minuten." />
      ) : (
        prospects.map((prospect) => (
          <ProspectCard
            key={prospect.id}
            prospect={prospect}
            offers={offers.filter((offer) => offer.prospect_id === prospect.id)}
            current={(!prospect.valid_from || prospect.valid_from <= day) && (!prospect.valid_to || prospect.valid_to >= day)}
            open={openId === prospect.id}
            onToggle={() => setOpenId(openId === prospect.id ? null : prospect.id)}
            onChanged={onChanged}
          />
        ))
      )}
    </div>
  )
}

function UploadForm({ householdId, onUploaded }: { householdId: string; onUploaded: () => void }) {
  const [store, setStore] = useState<string>(STORES[0])
  const [otherStore, setOtherStore] = useState('')
  const [validFrom, setValidFrom] = useState('')
  const [validTo, setValidTo] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const storeName = store === 'Andere' ? otherStore.trim() : store
  const busy = progress !== null

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!file || !storeName) return
    setError(null)
    setDone(false)
    try {
      await uploadProspect({ householdId, store: storeName, file, validFrom: validFrom || null, validTo: validTo || null, onProgress: setProgress })
      setFile(null)
      setValidFrom('')
      setValidTo('')
      if (fileInput.current) fileInput.current.value = ''
      setDone(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setProgress(null)
      onUploaded()
    }
  }

  return (
    <form className="card space-y-3 p-4" onSubmit={(event) => void submit(event)}>
      <h2 className="font-semibold">Prospekt hochladen</h2>
      <div className="flex flex-wrap gap-2">
        {[...STORES, 'Andere'].map((name) => (
          <button type="button" key={name} className={`chip ${store === name ? 'chip-active' : ''}`} aria-pressed={store === name} onClick={() => setStore(name)}>
            {name}
          </button>
        ))}
      </div>
      {store === 'Andere' && (
        <input className="input" placeholder="Name des Markts" aria-label="Name des Markts" value={otherStore} maxLength={40} onChange={(event) => setOtherStore(event.target.value)} />
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm text-muted">
          Gültig ab
          <input className="input mt-1" type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} />
        </label>
        <label className="text-sm text-muted">
          Gültig bis
          <input className="input mt-1" type="date" value={validTo} min={validFrom || undefined} onChange={(event) => setValidTo(event.target.value)} />
        </label>
      </div>
      <p className="text-xs text-muted">Leer lassen, dann liest die KI die Daten aus dem Prospekt. Für die kommende Woche einfach das neue PDF hochladen.</p>
      <input
        ref={fileInput}
        className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-primary-soft file:px-4 file:py-2 file:font-semibold file:text-primary-soft-ink"
        type="file"
        accept="application/pdf,.pdf"
        aria-label="PDF auswählen"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />
      {error && <ErrorBox message={error} />}
      {progress && (
        <p className="text-sm text-muted" role="status">
          {progress}
        </p>
      )}
      {done && (
        <p className="fade-in rounded-xl bg-primary-soft p-3 text-sm text-primary-soft-ink" role="status">
          Hochgeladen. Die KI liest jetzt die Angebote aus, du kannst die App dabei schließen.
        </p>
      )}
      <button className="btn btn-primary w-full" disabled={!file || !storeName || busy}>
        <FileUp size={18} aria-hidden /> {busy ? 'Wird hochgeladen …' : 'Hochladen und auslesen'}
      </button>
    </form>
  )
}

function ProspectCard({
  prospect,
  offers,
  current,
  open,
  onToggle,
  onChanged,
}: {
  prospect: Prospect
  offers: Offer[]
  current: boolean
  open: boolean
  onToggle: () => void
  onChanged: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [search, setSearch] = useState('')

  const run = async (task: () => Promise<unknown>) => {
    setError(null)
    try {
      await task()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      onChanged()
    }
  }

  const remove = () => {
    if (window.confirm(`Prospekt von ${prospect.store} mit allen Angeboten löschen?`)) void run(() => deleteProspect(prospect))
  }

  // Ohne Fortschritt seit fuenf Minuten ist das Auslesen vermutlich abgebrochen, dann darf man neu starten.
  const stuck = prospect.status === 'processing' && Date.now() - new Date(prospect.updated_at).getTime() > 5 * 60_000
  const term = search.trim().toLowerCase()
  const list = useMemo(
    () =>
      offers
        .filter((offer) => !term || `${offer.name} ${offer.brand ?? ''}`.toLowerCase().includes(term))
        .sort((a, b) => (a.page ?? 0) - (b.page ?? 0) || a.name.localeCompare(b.name, 'de')),
    [offers, term],
  )

  return (
    <section className="card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
          <Store size={20} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">
            {prospect.store}
            {current && prospect.status === 'ready' && <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary-soft-ink">gilt</span>}
          </h3>
          <p className="text-sm text-muted">{validityText(prospect.valid_from, prospect.valid_to)}</p>
          <p className="text-sm text-muted">
            {prospect.status === 'ready'
              ? `${prospect.offer_count} Angebote`
              : prospect.status === 'error'
                ? prospect.error ?? 'Auslesen fehlgeschlagen'
                : stuck
                  ? 'Das Auslesen hängt fest. Tippe auf „Erneut auslesen“.'
                : prospect.chunks_total > 0
                  ? `Wird ausgelesen … ${prospect.chunks_done} von ${prospect.chunks_total} Teilen`
                  : 'Wird hochgeladen …'}
          </p>
        </div>
        <button className="icon-btn" aria-label={`Prospekt von ${prospect.store} löschen`} onClick={remove}>
          <Trash2 size={20} />
        </button>
      </div>

      {(prospect.status === 'processing' || prospect.status === 'uploaded') && prospect.chunks_total > 0 && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
          <div className="h-full bg-primary transition-all" style={{ width: `${Math.max(5, (prospect.chunks_done / prospect.chunks_total) * 100)}%` }} />
        </div>
      )}

      {error && <div className="mt-3"><ErrorBox message={error} /></div>}

      <div className="mt-3 flex flex-wrap gap-2">
        {prospect.status === 'ready' && (
          <button className="chip" aria-expanded={open} onClick={onToggle}>
            {open ? 'Angebote ausblenden' : 'Angebote zeigen'}
          </button>
        )}
        {prospect.status !== 'processing' && (
          <button className="chip" onClick={() => setEditing(!editing)}>
            Gültigkeit ändern
          </button>
        )}
        {(prospect.status === 'error' || stuck) && (
          <button className="chip" onClick={() => void run(() => startReading(prospect.id))}>
            <RefreshCw size={14} aria-hidden /> Erneut auslesen
          </button>
        )}
      </div>

      {editing && (
        <ValidityEditor
          prospect={prospect}
          onSave={(from, to) =>
            void run(async () => {
              await updateValidity(prospect.id, from, to)
              setEditing(false)
            })
          }
        />
      )}

      {open && (
        <div className="mt-3 space-y-2">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-3.5 text-muted" aria-hidden />
            <input className="input !pl-9" type="search" placeholder="Angebot suchen" aria-label="Angebot suchen" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          {list.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">Nichts gefunden</p>
          ) : (
            <ul className="divide-y divide-line">
              {list.map((offer) => (
                <OfferRow key={offer.id} offer={offer} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

function ValidityEditor({ prospect, onSave }: { prospect: Prospect; onSave: (from: string | null, to: string | null) => void }) {
  const [from, setFrom] = useState(prospect.valid_from ?? '')
  const [to, setTo] = useState(prospect.valid_to ?? '')
  return (
    <div className="mt-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm text-muted">
          Gültig ab
          <input className="input mt-1" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="text-sm text-muted">
          Gültig bis
          <input className="input mt-1" type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} />
        </label>
      </div>
      <button className="btn btn-primary w-full" onClick={() => onSave(from || null, to || null)}>
        Speichern
      </button>
    </div>
  )
}

function OfferRow({ offer, showStore = false, likely = false }: { offer: Offer; showStore?: boolean; likely?: boolean }) {
  const details = [offer.brand, offer.quantity, offer.base_price].filter(Boolean).join(' · ')
  return (
    <li className="flex items-start gap-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="leading-snug">
          {offer.name}
          {likely && <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">vermutlich passend</span>}
        </p>
        {details && <p className="text-sm text-muted">{details}</p>}
        {(showStore || offer.condition) && (
          <p className="text-xs text-muted">{[showStore && offer.store, offer.condition].filter(Boolean).join(' · ')}</p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className="font-semibold">{formatPrice(offer.price)}</p>
        {offer.original_price !== null && <p className="text-xs text-muted line-through">{formatPrice(offer.original_price)}</p>}
      </div>
    </li>
  )
}

/* ------------------------------------------------------------------ Eure Gerichte */

function RecipesTab({ householdId, userId, offers }: { householdId: string; userId: string; offers: Offer[] }) {
  const { data: recipes, loading } = useRecipes(householdId)
  const scans = useMemo(() => scanRecipes(recipes ?? [], offers), [recipes, offers])
  const [shopping, setShopping] = useState<{ title: string; ingredients: Ingredient[] } | null>(null)
  const [added, setAdded] = useState<string | null>(null)

  if (offers.length === 0) return <NoOffers week />
  if (loading && !recipes) return <Spinner />
  if (scans.length === 0) return <EmptyState icon={Search} title="Keine Treffer" text="Bei euren schon gekochten Gerichten ist gerade nichts im Angebot." />

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Schon gekochte Gerichte, die meisten Zutaten im Angebot zuerst.</p>
      {added && (
        <p className="fade-in rounded-xl bg-primary-soft p-3 text-sm text-primary-soft-ink" role="status">
          {added}{' '}
          <Link to="/einkauf" className="font-semibold underline">
            Zur Einkaufsliste
          </Link>
        </p>
      )}
      {scans.map((scan) => (
        <section key={scan.recipe.id} className="card p-4">
          <RecipeHead recipeId={scan.recipe.id} title={scan.recipe.title} imagePath={scan.recipe.image_path} rating={scan.recipe.rating} />
          <ul className="mt-2 divide-y divide-line">
            {scan.matches.map((match) => (
              <li key={match.ingredient} className="py-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{match.ingredient}</p>
                <ul>
                  <OfferRow offer={match.best.offer} showStore likely={match.best.confidence === 'likely'} />
                </ul>
                {match.count > 1 && <p className="text-xs text-muted">und {match.count === 2 ? '1 weiteres Angebot' : `${match.count - 1} weitere Angebote`}</p>}
              </li>
            ))}
          </ul>
          <button className="btn btn-soft mt-2 w-full" onClick={() => setShopping({ title: scan.recipe.title, ingredients: scan.recipe.recipe_ingredients })}>
            Zutaten auf die Einkaufsliste
          </button>
        </section>
      ))}
      {shopping && (
        <AddToShoppingSheet
          householdId={householdId}
          userId={userId}
          ingredients={shopping.ingredients}
          onClose={() => setShopping(null)}
          onAdded={(count) => {
            setAdded(`${count === 1 ? '1 Zutat' : `${count} Zutaten`} für ${shopping.title} auf der Liste.`)
            setShopping(null)
          }}
        />
      )}
    </div>
  )
}

function RecipeHead({ recipeId, title, imagePath, rating }: { recipeId: string; title: string; imagePath: string | null; rating: number | null }) {
  const imageUrl = useImageUrl(imagePath)
  return (
    <Link to={`/rezepte/${recipeId}`} className="flex items-center gap-3">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-2 text-muted">
        {imageUrl ? <img src={imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : <ImageOff size={18} aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-snug">{title}</span>
        <StarsDisplay value={rating} />
      </span>
    </Link>
  )
}

/* ------------------------------------------------------------------ Einkaufsliste */

function ShoppingTab({ householdId, userId, offers }: { householdId: string; userId: string; offers: Offer[] }) {
  const shopping = useShopping(householdId, userId)
  const comparison = useMemo(() => compareShoppingList(shopping.items, offers), [shopping.items, offers])
  const withOffers = comparison.filter((entry) => entry.matches.length > 0)
  const without = comparison.filter((entry) => entry.matches.length === 0)

  if (offers.length === 0) return <NoOffers week />
  if (shopping.loading && shopping.items.length === 0) return <Spinner />
  if (comparison.length === 0) return <EmptyState icon={Search} title="Einkaufsliste ist leer" />

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Für jeden offenen Eintrag die passenden Angebote, das günstigste zuerst.</p>
      {withOffers.map(({ item, matches }) => (
        <ComparisonCard key={item.id} name={item.name} matches={matches} />
      ))}
      {without.length > 0 && (
        <section className="card p-4">
          <h3 className="font-semibold">Nicht im Angebot</h3>
          <p className="mt-1 text-sm text-muted">{without.map((entry) => entry.item.name).join(', ')}</p>
        </section>
      )}
    </div>
  )
}

function ComparisonCard({ name, matches }: { name: string; matches: OfferMatch[] }) {
  const [all, setAll] = useState(false)
  const shown = all ? matches : matches.slice(0, 3)
  return (
    <section className="card p-4">
      <h3 className="font-semibold">{name}</h3>
      <ul className="divide-y divide-line">
        {shown.map((match) => (
          <OfferRow key={match.offer.id} offer={match.offer} showStore likely={match.confidence === 'likely'} />
        ))}
      </ul>
      {matches.length > 3 && (
        <button className="chip mt-1" onClick={() => setAll(!all)}>
          {all ? 'Weniger zeigen' : `Alle ${matches.length} zeigen`}
        </button>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ Wochenplan (Test) */

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const WEEKDAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']

function WeekPlanSheet({ householdId, userId, offers, onClose }: { householdId: string; userId: string; offers: Offer[]; onClose: () => void }) {
  const { data: recipes, loading } = useRecipes(householdId)
  const { data: cached } = useCachedSuggestions(householdId)
  const [skip, setSkip] = useState<string[]>([])
  // Welche Tage gekocht wird, 0 = Montag. Gemerkt, weil sich das selten aendert.
  const [cookDays, setCookDays] = useState<number[]>(() => readCache<number[]>('weekplan-days') ?? [0, 1, 2, 3, 4])
  const toggleDay = (day: number) => {
    const next = cookDays.includes(day) ? cookDays.filter((entry) => entry !== day) : [...cookDays, day].sort((a, b) => a - b)
    setCookDays(next)
    writeCache('weekplan-days', next)
  }
  const [shopping, setShopping] = useState(false)
  const [added, setAdded] = useState<number | null>(null)

  const suggestions = useMemo(
    () => (cached?.suggestions ?? []).filter((suggestion) => !cached?.feedback.includes(suggestion.name)),
    [cached],
  )
  const plan = useMemo(() => weekPlan(recipes ?? [], offers, suggestions, { skip, days: cookDays.length }), [recipes, offers, suggestions, skip, cookDays])
  const key = (entry: PlanEntry) => (entry.kind === 'recipe' ? entry.recipe.id : entry.suggestion.name)

  const ingredients: Ingredient[] = plan.flatMap((entry) =>
    entry.kind === 'recipe'
      ? entry.recipe.recipe_ingredients
      : entry.suggestion.main_ingredients.map((name, sort_order) => ({ name, quantity: null, unit: null, sort_order })),
  )

  if (shopping) {
    return (
      <AddToShoppingSheet
        householdId={householdId}
        userId={userId}
        ingredients={ingredients}
        onClose={() => setShopping(false)}
        onAdded={(count) => {
          setShopping(false)
          setAdded(count)
        }}
      />
    )
  }

  return (
    <Sheet title="Wochenplan-Vorschlag" onClose={onClose}>
      <p className="text-sm text-muted">Ein erster Test: Lieblingsgerichte mit Zutaten im Angebot, Fälliges und eine neue Idee. Tippe die Tage an, an denen ihr kocht, und „Anderes“, um ein Gericht zu tauschen.</p>
      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="An welchen Tagen wird gekocht?">
        {WEEKDAYS.map((label, day) => (
          <button
            key={label}
            className={`chip !min-w-10 justify-center !px-2 ${cookDays.includes(day) ? 'chip-active' : ''}`}
            aria-pressed={cookDays.includes(day)}
            aria-label={WEEKDAY_NAMES[day]}
            onClick={() => toggleDay(day)}
          >
            {label}
          </button>
        ))}
      </div>
      {loading && !recipes ? (
        <Spinner />
      ) : cookDays.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Wähle mindestens einen Tag aus.</p>
      ) : plan.length === 0 ? (
        <EmptyState icon={Sparkles} title="Noch zu wenig bewertet" text="Bewertet ein paar gekochte Gerichte mit mindestens 3 Sternen, dann klappt der Plan." />
      ) : (
        <ol className="mt-3 space-y-2">
          {plan.map((entry, index) => (
            <li key={key(entry)} className="flex items-start gap-3 rounded-xl bg-surface-2 p-3">
              <span className="w-8 shrink-0 pt-0.5 text-sm font-semibold text-muted" title={WEEKDAY_NAMES[cookDays[index]]}>
                {WEEKDAYS[cookDays[index]]}
              </span>
              <div className="min-w-0 flex-1">
                {entry.kind === 'recipe' ? (
                  <Link to={`/rezepte/${entry.recipe.id}`} className="font-semibold leading-snug">
                    {entry.recipe.title}
                  </Link>
                ) : (
                  <p className="font-semibold leading-snug">{entry.suggestion.name}</p>
                )}
                <p className="text-xs text-muted">{entry.reasons.join(' · ')}</p>
              </div>
              <button className="chip shrink-0" onClick={() => setSkip([...skip, key(entry)])}>
                Anderes
              </button>
            </li>
          ))}
        </ol>
      )}
      {added !== null && (
        <p className="fade-in mt-3 rounded-xl bg-primary-soft p-3 text-sm text-primary-soft-ink" role="status">
          {added === 1 ? '1 Zutat' : `${added} Zutaten`} auf der Liste.{' '}
          <Link to="/einkauf" className="font-semibold underline">
            Zur Einkaufsliste
          </Link>
        </p>
      )}
      {plan.length > 0 && (
        <div className="mt-3 flex gap-2">
          {skip.length > 0 && (
            <button className="btn btn-soft" onClick={() => setSkip([])}>
              Zurücksetzen
            </button>
          )}
          <button className="btn btn-primary flex-1" onClick={() => setShopping(true)}>
            Alle Zutaten auf die Liste
          </button>
        </div>
      )}
    </Sheet>
  )
}
