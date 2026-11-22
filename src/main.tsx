import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Safari auf dem iPhone zeigt den gedrueckten Zustand (:active) von Knoepfen nur, wenn die Seite auf Beruehrungen hoert.
document.addEventListener('touchstart', () => {}, { passive: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
