import { Link } from 'react-router-dom'
import {
  MessageSquareCode, Users, Database, Zap, ArrowRight,
  QrCode, Bell, Image as ImageIcon, ShoppingBag, MessageCircleQuestion, Calendar,
} from 'lucide-react'
import Footer from '../components/Footer'
import WakalaLogo from '../components/Wakalalogo'
import { TOOLS } from '../data/tools'
import SiteNav from '../components/SiteNav'

const FEATURES = [
  {
    icon: MessageSquareCode,
    title: 'AI Anayejibu kwa Kiswahili',
    description:
      'Msaidizi mahiri anayejua bidhaa zako au taarifa za taasisi yako — anajibu papo hapo, hata usiku.',
    color: 'text-indigo-400', bg: 'bg-indigo-400/10',
  },
  {
    icon: QrCode,
    title: 'Link na QR Code Yako Mwenyewe',
    description:
      'Pakua QR code yenye nembo yako, bandika kwenye duka, ofisi, au mitandao ya kijamii. Watu wanascan na kuanza kuchati papo hapo.',
    color: 'text-emerald-400', bg: 'bg-emerald-400/10',
  },
  {
    icon: Bell,
    title: 'Arifa za SMS Papo Hapo',
    description:
      'Lead au ombi jipya linapopatikana, unapata SMS papo hapo — jina, mada, na namba ya simu. Hauhitaji kufungua dashibodi kila wakati.',
    color: 'text-amber-400', bg: 'bg-amber-400/10',
  },
  {
    icon: Database,
    title: 'Hifadhi ya Maarifa Mahiri',
    description:
      'Pakia maelezo yako, bidhaa, au sera na maswali ya mara kwa mara. AI inatumia taarifa hizi kujibu kwa usahihi — si kubahatisha.',
    color: 'text-yellow-400', bg: 'bg-yellow-400/10',
  },
  {
    icon: ImageIcon,
    title: 'Chapa Yako, Sio Yetu',
    description:
      'Weka nembo yako kwenye chati, QR code, na widget. Watu wanaona chapa yako — tunabaki nyuma ya pazia.',
    color: 'text-purple-400', bg: 'bg-purple-400/10',
  },
  {
    icon: Calendar,
    title: 'Mipango Rahisi',
    description:
      'Chagua mpango wa siku, wiki, mwezi, au miezi mitatu. Ukiisha, badilisha kwa haraka — hakuna usumbufu.',
    color: 'text-blue-400', bg: 'bg-blue-400/10',
  },
]

const BOT_MODES = [
  {
    icon: ShoppingBag,
    title: 'Ninauza',
    subtitle: 'Kwa maduka, biashara za mtandaoni, wauzaji',
    description:
      'Bot inajibu bei, stock, na maeneo ya delivery. Mteja akionyesha nia ya kununua, unapata SMS na namba yake ya simu papo hapo.',
    color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30',
  },
  {
    icon: MessageCircleQuestion,
    title: 'Majibu Tu',
    subtitle: 'Kwa shule, ofisi, taasisi, mashirika',
    description:
      'Bot inajibu maswali ya kawaida kuhusu taasisi yako — masharti, taratibu, mawasiliano. Hakuna mauzo, taarifa tu zinazohitajika.',
    color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30',
  },
]

function FeatureCard({ icon: Icon, title, description, color, bg }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col gap-4 hover:border-gray-700 transition-colors">
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <h3 className="text-base font-semibold text-white mb-1">{title}</h3>
        <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      
      <SiteNav />

      <section className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="max-w-3xl mx-auto space-y-8 mb-12">

          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-300 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Imetengenezwa kwa ajili ya Wa-Tanzania
          </span>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight text-white">
            Wateja na wageni wako wanauliza{' '}
            <span className="text-indigo-400">maswali yale yale</span>
            {' '}kila siku.{' '}
            <span className="text-indigo-400">Sasa wanapata jibu papo hapo.</span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-400 leading-relaxed max-w-2xl mx-auto">
            Wakalabot ni msaidizi wa AI kwa Kiswahili — kwa biashara zinazouza bidhaa au huduma,
            na kwa taasisi zinazohitaji tu kujibu maswali. Unachagua aina yako, tunashughulikia
            majibu, papo hapo, hata usiku.
          </p>

          <div className="flex justify-center">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-8 py-3.5 text-base font-semibold text-white transition-colors shadow-lg shadow-indigo-600/20"
            >
              Anza Bure Sasa
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <p className="text-sm text-gray-500 font-medium">
            🎁 Fungua akaunti bila malipo — hauhitaji kadi yoyote kuanza
          </p>
        </div>

        <div className="w-full max-w-md mx-auto border border-gray-800 bg-gray-900 rounded-2xl overflow-hidden shadow-2xl text-left">
          <div className="bg-gray-800/50 px-4 py-3 border-b border-gray-800 flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-gray-300">Hivi ndivyo mteja wako anavyoona</span>
          </div>
          <div className="p-4 space-y-3 h-48 overflow-y-auto text-xs flex flex-col justify-end">
            <div className="bg-gray-800 text-gray-300 rounded-lg p-3 max-w-[80%] self-start">
              Habari, mna shati jeusi size L? Na delivery Posta ni bei gani?
            </div>
            <div className="bg-indigo-600 text-white rounded-lg p-3 max-w-[80%] self-end">
              Habari! Ndiyo, tunazo 4 zilizobaki size L. Delivery Posta ni 3,000 TZS. Je, niandae order yako sasa?
            </div>
          </div>
        </div>
      </section>

      {/* Two bot modes */}
      <section className="px-6 py-20 border-t border-gray-800 bg-gray-900/30">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-bold text-white">Chagua aina ya bot yako</h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Wakalabot inafanya kazi kwa njia mbili — chagua inayokufaa wakati wa usajili.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {BOT_MODES.map((mode) => {
              const Icon = mode.icon
              return (
                <div
                  key={mode.title}
                  className={`rounded-2xl border ${mode.border} bg-gray-900 p-8 space-y-4`}
                >
                  <div className={`w-12 h-12 rounded-xl ${mode.bg} flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${mode.color}`} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{mode.title}</h3>
                    <p className={`text-sm font-medium mt-0.5 ${mode.color}`}>{mode.subtitle}</p>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed">{mode.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 border-t border-gray-800 bg-gray-900/30">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-bold text-white">Zana za Bure kwa Wafanyabiashara</h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Tengeneza orodha ya bei, risiti, na ujumbe wa WhatsApp. Hakuna usajili.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TOOLS.filter(t => !t.soon).slice(0, 4).map(tool => {
              const Icon = tool.icon
              return (
                <Link key={tool.path} to={tool.path}
                  className="bg-gray-900 border border-gray-800 hover:border-indigo-500/50 rounded-xl p-5 space-y-3 transition-colors">
                  <div className={`w-10 h-10 rounded-xl ${tool.iconBg} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${tool.iconColor}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{tool.title}</p>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">{tool.desc}</p>
                  </div>
                </Link>
              )
            })}
          </div>
          <div className="text-center">
            <Link to="/tools" className="inline-flex items-center gap-2 text-sm font-medium text-indigo-400 hover:text-indigo-300">
              Tazama zana zote <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
</section>

      <section className="px-6 py-20 border-t border-gray-800">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-bold text-white">Kila kitu unachohitaji</h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Kutoka chati ya AI mpaka arifa za SMS — Wakalabot inakupa zana zote za kuwahudumia
              wateja au wageni wako bila kuajiri mtu wa ziada.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16 border-t border-gray-800 bg-gray-900/40">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-2xl font-bold text-white">Uko tayari kuanza?</h2>
          <p className="text-gray-400">
            Fungua akaunti, weka taarifa zako, pata QR code yako, na uone watu wakianza kuchati
            dakika chache baadaye.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition-colors"
          >
            Jisajili Bure <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}