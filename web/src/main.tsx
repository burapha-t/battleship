import '@fontsource/baloo-2/latin-500.css'
import '@fontsource/baloo-2/latin-700.css'
import '@fontsource/baloo-2/latin-800.css'
import '@fontsource/nunito/latin-600.css'
import '@fontsource/nunito/latin-700.css'
import '@fontsource/nunito/latin-800.css'
import '@fontsource/nunito/latin-900.css'
import './theme.css'
import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { BoardPreview } from './dev/BoardPreview.tsx'

const preview = new URLSearchParams(window.location.search).get('preview')

createRoot(document.getElementById('root')!).render(
  <StrictMode>{preview === 'board' ? <BoardPreview /> : <App />}</StrictMode>,
)
