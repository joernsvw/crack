import { useState } from 'react'
import { PageHeader } from '../components/ui'
import { useHousehold } from '../context/HouseholdContext'
import { LeftoversTab } from '../features/discover/LeftoversTab'
import { SuggestionsTab } from '../features/discover/SuggestionsTab'
import { TasteProfileTab } from '../features/discover/TasteProfileTab'

const SECTIONS = [
  { id: 'suggestions', label: 'Vorschläge' },
  { id: 'leftovers', label: 'Reste' },
  { id: 'taste', label: 'Geschmack' },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

export function DiscoverPage() {
  const { householdId } = useHousehold()
  const [section, setSection] = useState<SectionId>('suggestions')

  return (
    <>
      <PageHeader title="Entdecken" settings />
      <main className="mx-auto max-w-2xl px-4">
        <div className="mb-4 grid grid-cols-3 gap-2" role="tablist">
          {SECTIONS.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              aria-selected={section === id}
              className={`chip justify-center ${section === id ? 'chip-active' : ''}`}
              onClick={() => setSection(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {section === 'suggestions' && <SuggestionsTab householdId={householdId} />}
        {section === 'leftovers' && <LeftoversTab householdId={householdId} />}
        {section === 'taste' && <TasteProfileTab householdId={householdId} />}
      </main>
    </>
  )
}
