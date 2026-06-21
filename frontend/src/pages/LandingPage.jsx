// import { Link } from 'react-router-dom'
// import { BotMessageSquare, Cpu, DollarSign, Users, ShieldCheck, ArrowRight, Zap, Database } from 'lucide-react'

// const FEATURES = [
//   {
//     icon: Cpu,
//     title: 'Fully Offline Operation',
//     description:
//       'Run your entire management system without a constant internet connection. All core operations work locally — no cloud dependency, no downtime surprises.',
//     color: 'text-indigo-400',
//     bg: 'bg-indigo-400/10',
//   },
//   {
//     icon: DollarSign,
//     title: 'Zero Per-Token API Costs',
//     description:
//       'Eliminate expensive per-request AI charges. Our platform uses locally-hosted models so you pay a flat, predictable price — not a bill that grows with usage.',
//     color: 'text-emerald-400',
//     bg: 'bg-emerald-400/10',
//   },
//   {
//     icon: Users,
//     title: 'Multi-Tenant Architecture',
//     description:
//       'Serve multiple businesses from a single deployment. Each tenant gets isolated data, their own product catalogue, knowledge base, and analytics — all in one platform.',
//     color: 'text-blue-400',
//     bg: 'bg-blue-400/10',
//   },
//   {
//     icon: ShieldCheck,
//     title: 'Secure Local Data Storage',
//     description:
//       'Your data never leaves your infrastructure. Sensitive records are encrypted at rest and queries are always scoped to the owning tenant — security by design.',
//     color: 'text-purple-400',
//     bg: 'bg-purple-400/10',
//   },
//   {
//     icon: Database,
//     title: 'Smart Knowledge Base',
//     description:
//       'Build a vector-powered knowledge base for your business. The system uses semantic search to surface the most relevant information instantly.',
//     color: 'text-yellow-400',
//     bg: 'bg-yellow-400/10',
//   },
//   {
//     icon: Zap,
//     title: 'Streamlined Automation',
//     description:
//       'Automate repetitive tasks — product catalogues, customer records, analytics reports — freeing your team to focus on what matters most.',
//     color: 'text-rose-400',
//     bg: 'bg-rose-400/10',
//   },
// ]

// function FeatureCard({ icon: Icon, title, description, color, bg }) {
//   return (
//     <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col gap-4 hover:border-gray-700 transition-colors">
//       <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
//         <Icon className={`w-5 h-5 ${color}`} />
//       </div>
//       <div>
//         <h3 className="text-base font-semibold text-white mb-1">{title}</h3>
//         <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
//       </div>
//     </div>
//   )
// }

// export default function LandingPage() {
//   return (
//     <div className="min-h-screen bg-gray-950 text-white flex flex-col">
//       {/* ── Nav ── */}
//       <nav className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
//         <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
//           <div className="flex items-center gap-2">
//             <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
//               <BotMessageSquare className="w-5 h-5 text-white" />
//             </div>
//             <span className="text-lg font-bold text-white">WakalaBot</span>
//           </div>
//           <Link
//             to="/signin"
//             className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
//           >
//             Sign in
//           </Link>
//         </div>
//       </nav>

//       {/* ── Hero ── */}
//       <section className="flex-1 flex items-center justify-center px-6 py-20 text-center">
//         <div className="max-w-3xl mx-auto space-y-8">
//           {/* Badge */}
//           <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-300 uppercase tracking-wider">
//             <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
//             Smart Business Management
//           </span>

//           {/* Headline */}
//           <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight text-white">
//             Manage your business{' '}
//             <span className="text-indigo-400">without limits</span>
//           </h1>

//           {/* Sub-headline */}
//           <p className="text-lg sm:text-xl text-gray-400 leading-relaxed max-w-2xl mx-auto">
//             Experience a smart, fully automated management system designed to streamline your
//             business operations completely offline — eliminating expensive per-token API costs.
//             Empower your local market with an affordable, multi-tenant digital platform built to
//             handle your data securely and efficiently.
//           </p>

//           {/* CTA */}
//           <div className="flex justify-center">
//             <Link
//               to="/signin"
//               className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-8 py-3.5 text-base font-semibold text-white transition-colors shadow-lg shadow-indigo-600/20"
//             >
//               Get Started
//               <ArrowRight className="w-4 h-4" />
//             </Link>
//           </div>

//           {/* Social proof */}
//           <p className="text-sm text-gray-600">
//             No credit card required &mdash; free trial included
//           </p>
//         </div>
//       </section>

//       {/* ── Features ── */}
//       <section className="px-6 py-20 border-t border-gray-800">
//         <div className="max-w-6xl mx-auto space-y-12">
//           <div className="text-center space-y-3">
//             <h2 className="text-3xl font-bold text-white">Everything your business needs</h2>
//             <p className="text-gray-400 max-w-xl mx-auto">
//               One platform to manage products, customers, analytics, and your AI-powered knowledge
//               base — built for the local market.
//             </p>
//           </div>

//           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
//             {FEATURES.map((f) => (
//               <FeatureCard key={f.title} {...f} />
//             ))}
//           </div>
//         </div>
//       </section>

//       {/* ── Footer CTA ── */}
//       <section className="px-6 py-20 border-t border-gray-800 text-center">
//         <div className="max-w-xl mx-auto space-y-6">
//           <h2 className="text-2xl font-bold text-white">Ready to streamline your operations?</h2>
//           <p className="text-gray-400">
//             Join businesses already running smarter with WakalaBot.
//           </p>
//           <Link
//             to="/signin"
//             className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-8 py-3.5 text-base font-semibold text-white transition-colors"
//           >
//             Get Started
//             <ArrowRight className="w-4 h-4" />
//           </Link>
//         </div>
//       </section>

//       {/* ── Page footer ── */}
//       <footer className="border-t border-gray-800 bg-gray-900 px-6 py-6 text-center">
//         <p className="text-xs text-gray-600">
//           © {new Date().getFullYear()} WakalaBot. All rights reserved. &nbsp;·&nbsp;
//           <Link to="/terms" className="hover:text-gray-400 transition-colors">Terms</Link>
//           &nbsp;·&nbsp;
//           <Link to="/privacy" className="hover:text-gray-400 transition-colors">Privacy</Link>
//         </p>
//       </footer>
//     </div>
//   )
// }


import { Link } from 'react-router-dom'
import { BotMessageSquare, Smartphone, Coins, Users, MessageSquareCode, ArrowRight, Zap, Database } from 'lucide-react'
import Footer from '../components/Footer'

const FEATURES = [
  {
    icon: MessageSquareCode,
    title: 'Beautiful Customer Web Chat',
    description:
      'Give your customers a premium chat experience. A clean, responsive web interface that matches your business brand and answers inquiries instantly.',
    color: 'text-indigo-400',
    bg: 'bg-indigo-400/10',
  },
  {
    icon: Smartphone,
    title: 'Instant Android SMS Gateway',
    description:
      'Bypass long setup waiting times. Turn your local device into a personal message hub to text customers with zero external setup delays.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
  },
  {
    icon: Coins,
    title: 'Predictable Coin-Based Billing',
    description:
      'No surprise bills. Use straightforward coin bundles tailored to your message volume, making it easy to plan and scale your business budget.',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
  },
  {
    icon: Users,
    title: 'Multi-Tenant Platform Hub',
    description:
      'Perfect data separation. Your products, unique store rules, and operational customer customer logs are kept safe and completely secure.',
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
  },
  {
    icon: Database,
    title: 'Smart Knowledge Base',
    description:
      'Upload your business details, catalogs, or FAQs. The system reads your specific store parameters to surface the right details instantly.',
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
  },
  {
    icon: Zap,
    title: 'Blazing Fast Cloud AI Engine',
    description:
      'Powered by high-speed Groq infrastructure. Customer questions receive intelligent, accurate replies in milliseconds without lag.',
    color: 'text-rose-400',
    bg: 'bg-rose-400/10',
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
      {/* ── Nav ── */}
      <nav className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <BotMessageSquare className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white">WakalaBot</span>
          </div>
          <Link
            to="/signin"
            className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            Sign in
          </Link>
        </div>
      </nav>

    
      {/* ── Hero ── */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="max-w-3xl mx-auto space-y-8 mb-12">
          {/* Badge */}
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-300 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            AI Customer Service Hub
          </span>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight text-white">
            Automate your sales chat{' '}
            <span className="text-indigo-400">without limits</span>
          </h1>

          {/* Sub-headline */}
          <p className="text-lg sm:text-xl text-gray-400 leading-relaxed max-w-2xl mx-auto">
            Give your business a smart web assistant that responds to customer questions, showcases 
            your catalog, and captures leads automatically. Powered by reliable cloud infrastructure 
            and straightforward coin bundles built for local scale.
          </p>

          {/* CTA — Updated for Free Credits */}
          <div className="flex justify-center">
            <Link
              to="/signin"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-8 py-3.5 text-base font-semibold text-white transition-colors shadow-lg shadow-indigo-600/20"
            >
              Get Started for Free
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Social proof — Updated to explicitly mention the 100 coins */}
          <p className="text-sm text-gray-500 font-medium">
            🎁 Get 100 free coins instantly to test your assistant &mdash; no payment required
          </p>
        </div>

        {/* ── Mini Live Demo Simulation Mockup for UX ── */}
        <div className="w-full max-w-md mx-auto border border-gray-800 bg-gray-900 rounded-2xl overflow-hidden shadow-2xl text-left">
          <div className="bg-gray-800/50 px-4 py-3 border-b border-gray-800 flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-gray-300">Live Assistant Demo (What customers see)</span>
          </div>
          <div className="p-4 space-y-3 h-48 overflow-y-auto text-xs flex flex-col justify-end">
            <div className="bg-gray-800 text-gray-300 rounded-lg p-3 max-w-[80%] self-start">
              Habari! Do you have black shirts in size L, and how much is delivery to Posta?
            </div>
            <div className="bg-indigo-600 text-white rounded-lg p-3 max-w-[80%] self-end">
              Yes, we have 4 items left in stock! Delivery to Posta is 3,000 TZS. Would you like me to book your order now?
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="px-6 py-20 border-t border-gray-800">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-bold text-white">Everything your business needs</h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              One platform to host your interactive shop assistant, manage client history, and handle automated communications effortlessly.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <Footer />
    </div>
  )
}