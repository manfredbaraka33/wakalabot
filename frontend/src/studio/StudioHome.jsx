import { Link } from 'react-router-dom'
import { ArrowRight, Check, LayoutGrid, Palette, Ruler } from 'lucide-react'
import WakalaLogo from '../components/Wakalalogo'
import { getStudioToken } from './studioApi'

const MODES = [
  { icon: LayoutGrid, title: 'Miundo 21', color: 'text-indigo-400', bg: 'bg-indigo-500/15',
    text: 'Kadi, picha kubwa, neon, polaroid, dirisha na zaidi. Miundo mipya inaongezwa kila mara.' },
  { icon: Palette, title: 'Rangi 8', color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/15',
    text: 'Giza, Zumaridi, Machweo, Bahari, Waridi na zaidi. Ona muonekano papo hapo kabla ya kutengeneza.' },
  { icon: Ruler, title: 'Ukubwa wote', color: 'text-emerald-400', bg: 'bg-emerald-500/15',
    text: 'Post ya Instagram, Wima, Story ya WhatsApp Status, na A4 ya kuchapisha kama flyer.' },
]

const POINTS = [
  'Matangazo 3 na orodha ya bei ni BURE kila siku — ondoa alama kwa credits kidogo tu',
  'Kiswahili sahihi — maneno ya tangazo yanaandikwa na mfumo, hakuna makosa ya AI',
  'Lipa kidogo kidogo kwa M-Pesa, Tigo Pesa au Airtel Money',
  'Kazi yako ni ya faragha — hakuna ukurasa wa umma',
  'Kazi ikishindwa, credits zako zinarudi zenyewe',
]

export default function StudioHome() {
  const loggedIn = !!getStudioToken()
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 bg-gray-900/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link to="/" className="min-w-0 overflow-hidden"><WakalaLogo /></Link>
          <div className="flex items-center gap-3 shrink-0 text-sm">
            <Link to={loggedIn ? '/studio/app' : '/studio/login'} className="text-gray-300 hover:text-white">
              {loggedIn ? 'Fungua Studio' : 'Ingia'}
            </Link>
            {!loggedIn && (
              <Link to="/studio/signup" className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 font-semibold">Anza Bure</Link>
            )}
          </div>
        </div>
      </nav>

      <section className="max-w-3xl mx-auto px-4 pt-14 pb-10 text-center space-y-5">
        <span className="inline-block text-xs font-semibold uppercase tracking-widest text-fuchsia-300 bg-fuchsia-500/10 border border-fuchsia-500/30 rounded-full px-3 py-1">Wakalabot Studio</span>
        <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight">
          Tangazo la biashara yako, kwa Kiswahili, <span className="text-indigo-400">ndani ya sekunde.</span>
        </h1>
        <p className="text-gray-400 text-lg">
          Pakia picha ya bidhaa yako, chagua muundo na rangi. Studio inatengeneza tangazo tayari kwa Instagram, WhatsApp Status au kuchapisha — bila mbunifu, bila gharama kubwa.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link to={loggedIn ? '/studio/app' : '/studio/signup'}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-6 py-3 font-semibold">
            {loggedIn ? 'Fungua Studio' : 'Anza na credits 15 bure'} <ArrowRight className="w-4 h-4" />
          </Link>
          {!loggedIn && <Link to="/studio/login" className="rounded-xl border border-gray-700 hover:border-gray-600 px-6 py-3 text-gray-300">Nina akaunti</Link>}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 grid gap-4 sm:grid-cols-3">
        {MODES.map(({ icon: Icon, title, text, color, bg }) => (
          <div key={title} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
            <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center`}><Icon className={`w-5 h-5 ${color}`} /></div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-gray-400 leading-relaxed">{text}</p>
          </div>
        ))}
      </section>

      <section className="max-w-3xl mx-auto px-4 py-12 space-y-3">
        {POINTS.map((p) => (
          <div key={p} className="flex items-start gap-3 text-gray-300">
            <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" /> <span>{p}</span>
          </div>
        ))}
      </section>

      <footer className="border-t border-gray-800 py-6 text-center text-xs text-gray-600 space-x-4">
        <Link to="/terms" className="hover:text-gray-400">Masharti</Link>
        <Link to="/privacy" className="hover:text-gray-400">Faragha</Link>
      </footer>
    </div>
  )
}