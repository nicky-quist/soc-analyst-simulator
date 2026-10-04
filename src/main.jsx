import ReactDOM from 'react-dom/client'
import SOCAnalystSim from './SOCAnalystSim.jsx'
import { MODE_KEY, consumeSignInReturn } from './lib/onlineApi.js'
import { getSupabase } from './lib/supabase.js'

// Back from a sign-in redirect: land on the Online board and let Supabase
// exchange the ?code= for a session now, rather than whenever the tab is opened.
if (consumeSignInReturn()) {
  try {
    window.localStorage.setItem(MODE_KEY, 'online')
  } catch {
    // Storage unavailable: the player can open the Online tab by hand.
  }
  window.location.hash = '#leaderboard'
  getSupabase().catch(() => {})
}

ReactDOM.createRoot(document.getElementById('root')).render(<SOCAnalystSim />)
