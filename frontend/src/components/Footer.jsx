import { Link } from 'react-router-dom'
import { BotMessageSquare, Shield, Lock } from 'lucide-react'
import WakalaLogo from './Wakalalogo'

export default function Footer() {
  return (
    <footer className="border-t border-gray-800 bg-gray-900 mt-auto">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* Column A — Brand */}
          <div className="space-y-3">
            <WakalaLogo />
            <p className="text-sm text-gray-400 leading-relaxed">
              AI-Native Solutions from Tanzania.
              <br />
              Empowering businesses with automated, high-speed customer service hubs.
            </p>
            <p className="text-xs text-gray-600">
              © {new Date().getFullYear()} WakalaBot. All rights reserved.
            </p>
          </div>

          {/* Column B — Links */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
              Legal & Support
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/terms"
                  className="text-sm text-gray-400 hover:text-indigo-400 transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  to="/privacy"
                  className="text-sm text-gray-400 hover:text-indigo-400 transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  to="/dashboard/support"
                  className="text-sm text-gray-400 hover:text-indigo-400 transition-colors"
                >
                  Contact Support
                </Link>
              </li>
            </ul>
          </div>

          {/* Column C — Compliance */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
              Compliance
            </h3>
            <div className="space-y-2">
              {/* Data security badge */}
              <div className="flex items-center gap-2 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 w-fit">
                <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center">
                  <Lock className="w-3 h-3 text-indigo-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-indigo-400">Secure Cloud</p>
                  <p className="text-xs text-gray-500">Isolated database storage</p>
                </div>
              </div>

              {/* PDPA badge */}
              <div className="flex items-center gap-2 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 w-fit">
                <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Shield className="w-3 h-3 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-blue-400">PDPA 2022</p>
                  <p className="text-xs text-gray-500">TZ Privacy Compliant</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </footer>
  )
}