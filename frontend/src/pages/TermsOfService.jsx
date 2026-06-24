import ReactMarkdown from 'react-markdown'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import WakalaLogo from '../components/Wakalalogo'


// Embed the markdown content directly to avoid fetch CORS issues in dev
const TERMS_CONTENT = `
# Terms of Service

*Last updated: April 28, 2026*

## 1. Acceptance of Terms
By accessing or using Wakalabot ("the Service"), you agree to be bound by these Terms of Service and all applicable laws and regulations.

## 2. Description of Service
Wakalabot provides an AI-powered offline-first business management platform for organizations of all sizes — from SMEs to large enterprises, locally and internationally. The Service includes automated business operations, product catalogue management, and analytics.

## 3. User Accounts
You must register a business account to use the Service. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.

## 4. Payment & Billing
The Service operates on a coin-based system. Coins are credited to your account and consumed when AI features are used. All pricing is in Tanzanian Shillings (TZS). Purchased coins are non-refundable except as required by applicable law.

## 5. Acceptable Use
You agree not to use the Service to:
- Send spam, unsolicited messages, or engage in misleading communications
- Violate any applicable laws or regulations
- Infringe on the intellectual property rights of others
- Distribute malware or engage in any harmful activity

## 6. Data & Privacy
Your use of the Service is also governed by our [Privacy Policy](/privacy). By using the Service, you consent to the collection and use of your data as described therein.

## 7. Intellectual Property
The Service and its original content, features, and functionality are owned by Wakalabot and are protected by applicable intellectual property laws.

## 8. Limitation of Liability
To the maximum extent permitted by law, Wakalabot shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service.

## 9. Termination
We reserve the right to suspend or terminate your account at our sole discretion if you violate these Terms. You may terminate your account at any time by contacting support.

## 10. Governing Law
These Terms shall be governed by the laws of the United Republic of Tanzania, without regard to its conflict of law provisions.

## 11. Changes to Terms
We reserve the right to modify these Terms at any time. We will notify registered users of material changes via email. Continued use of the Service after changes constitutes acceptance of the new Terms.

## 12. Contact
For questions about these Terms, please contact us at **info@wakalabot.com**.

---
*Wakalabot — Accelerating Tanzanian and International businesses, from SMEs to large enterprises, using AI.*
`

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-white">
            <WakalaLogo />
          </Link>
          <Link to="/login" className="text-sm text-gray-400 hover:text-white transition-colors">
            Back to App →
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12">
        <div className="max-w-none">
          {/* Replaced 'prose' with explicit component element mapping */}
          <ReactMarkdown
            components={{
              h1: ({ ...props }) => <h1 className="text-3xl font-bold text-white mb-6" {...props} />,
              h2: ({ ...props }) => <h2 className="text-xl font-semibold text-white mt-8 mb-4 border-b border-gray-800 pb-2" {...props} />,
              p: ({ ...props }) => <p className="text-gray-300 text-sm mb-4 leading-relaxed" {...props} />,
              ul: ({ ...props }) => <ul className="list-disc pl-5 mb-4 space-y-2" {...props} />,
              li: ({ ...props }) => <li className="text-gray-300 text-sm" {...props} />,
              a: ({ ...props }) => <a className="text-[#6366f1] hover:underline" {...props} />,
              em: ({ ...props }) => <em className="text-gray-400 not-italic text-xs" {...props} />,
              hr: ({ ...props }) => <hr className="border-gray-800 my-8" {...props} />,
            }}
          >
            {TERMS_CONTENT}
          </ReactMarkdown>
        </div>
      </main>

      <Footer />
    </div>
  )
}