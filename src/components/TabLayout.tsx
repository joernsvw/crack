import { BookOpen, Compass, ShoppingCart, StickyNote } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

const TABS = [
  { to: '/einkauf', label: 'Einkauf', icon: ShoppingCart },
  { to: '/rezepte', label: 'Rezepte', icon: BookOpen },
  { to: '/entdecken', label: 'Entdecken', icon: Compass },
  { to: '/notizen', label: 'Notizen', icon: StickyNote },
]

export function TabLayout() {
  return (
    <div className="page-bottom min-h-dvh">
      <Outlet />
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto grid max-w-2xl grid-cols-4">
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                  isActive ? 'text-primary' : 'text-muted'
                }`
              }
            >
              <Icon size={24} aria-hidden />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
