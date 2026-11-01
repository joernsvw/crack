import { Compass } from 'lucide-react'
import { EmptyState, PageHeader } from '../components/ui'

export function DiscoverPage() {
  return (
    <>
      <PageHeader title="Entdecken" settings />
      <EmptyState
        icon={Compass}
        title="Kommt bald"
        text="Hier schlägt euch Crack später neue Gerichte vor, passend zu eurem Geschmack und zu dem, was noch im Kühlschrank liegt."
      />
    </>
  )
}
