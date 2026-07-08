import { Link } from 'react-router-dom'
import {
  MessageSquareCode, Coins, Users, Database, Zap, ArrowRight,
  QrCode, Bell, Image as ImageIcon, Smartphone,
} from 'lucide-react'
import Footer from '../components/Footer'
import WakalaLogo from '../components/Wakalalogo'

const FEATURES = [
  {
    icon: MessageSquareCode,
    title: 'AI Anayejibu kwa Kiswahili',
    description:
      'Msaidizi mahiri anayejua bidhaa zako, bei, hifadhi, na maeneo ya delivery — anajibu wateja papo hapo, hata usiku.',
    color: 'text-indigo-400', bg: 'bg-indigo-400/10',
  },
  {
    icon: QrCode,
    title: 'Link na QR Code Yako Mwenyewe',
    description:
      'Pakua QR code yenye nembo ya biashara yako, bandika kwenye duka au mitandao ya kijamii. Wateja wanascan na kuanza kuchati papo hapo.',
    color: 'text-emerald-400', bg: 'bg-emerald-400/10',
  },
  {
    icon: Bell,
    title: 'Arifa za SMS Papo Hapo',
    description:
      'Lead mpya inapopatikana, unapata SMS papo hapo — jina la mteja, bidhaa, na namba ya simu. Hauhitaji kufungua dashibodi kila wakati.',
    color: 'text-amber-400', bg: 'bg-amber-400/10',
  },
  {
    icon: Database,
    title: 'Hifadhi ya Maarifa Mahiri',
    description:
      'Pakia maelezo ya biashara yako, bidhaa, na maswali ya mara kwa mara. AI inatumia taarifa hizi kujibu kwa usahihi — si kubahatisha.',
    color: 'text-yellow-400', bg: 'bg-yellow-400/10',
  },
  {
    icon: ImageIcon,
    title: 'Chapa Yako, Sio Yetu',
    description:
      'Weka nembo ya biashara yako kwenye chati, QR code, na widget. Wateja wanaona biashara yako — tunabaki nyuma ya pazia.',
    color: 'text-purple-400', bg: 'bg-purple-400/10',
  },
  {
    icon: Coins,
    title: 'Bei Inayoeleweka',
    description:
      'Chagua mpango wa kila mwezi au nunua coins unapohitaji. Hakuna gharama za ghafla — unaona unachotumia.',
    color: 'text-blue-400', bg: 'bg-blue-400/10',
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
      <nav className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <WakalaLogo />
          <div className="flex items-center gap-4">
            <Link to="/register" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
              Jisajili
            </Link>
            <Link to="/signin" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
              Ingia
            </Link>
          </div>
        </div>
      </nav>

      <section className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="max-w-3xl mx-auto space-y-8 mb-12">
          
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-300 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Imetengenezwa kwa ajili ya Wafanyabiashara wa kitanzania
          </span>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight text-white">
            Wateja wako wanauliza{' '}
            <span className="text-indigo-400">"Bei gani?"</span>
            {' '}usiku na mchana.{' '}
            <span className="text-indigo-400">Sasa wanapata jibu papo hapo.</span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-400 leading-relaxed max-w-2xl mx-auto">
            Wakalabot ni msaidizi wa AI anayejibu wateja wako kwa Kiswahili, anaonyesha bidhaa zako,
            anahifadhi lead, na kukutumia SMS pale mteja anapotaka kununua — hata wewe ukiwa busy
            au umelala.
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
            🎁 Pata coins 100 bure papo hapo — hakuna malipo yanayohitajika kuanza
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

      <section className="px-6 py-20 border-t border-gray-800">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-bold text-white">Kila kitu unachohitaji kuwahudumia wateja</h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Kutoka chati ya AI mpaka arifa za SMS — Wakalabot inakupa zana zote za kuendesha
              huduma kwa wateja bila kuajiri mtu wa ziada.
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
          <h2 className="text-2xl font-bold text-white">Una wateja wengi, muda mdogo?</h2>
          <p className="text-gray-400">
            Anza leo, weka bidhaa zako, pata QR code yako, na uone wateja wakianza kuchati
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