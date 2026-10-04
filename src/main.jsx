import ReactDOM from 'react-dom/client'
import SOCAnalystSim from './SOCAnalystSim.jsx'
import { consumeSignInReturn } from './lib/onlineApi.js'
import { getSupabase } from './lib/supabase.js'

// Back from a sign-in redirect: land on the Leaderboard and let Supabase
// exchange the ?code= for a session now, rather than whenever the tab is opened.
if (consumeSignInReturn()) {
  window.location.hash = '#leaderboard'
  getSupabase().catch(() => {})
}

ReactDOM.createRoot(document.getElementById('root')).render(<SOCAnalystSim />)
