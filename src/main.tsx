import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

// Pick one starting point per page load, shared by every animated palette color.
document.documentElement.style.setProperty('--palette-phase', String(Math.random()))

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
