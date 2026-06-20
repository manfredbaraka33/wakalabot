import ReactMarkdown from 'react-markdown'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'

const PRIVACY_CONTENT = `
# Privacy Policy

*Last updated: April 28, 2026*

## 1. Introduction
Wakalabot ("we", "us", or "our") is committed to protecting your personal information in accordance with the **Personal Data Protection Act, 2022 (PDPA 2022)** of the United Republic of Tanzania. This Privacy Policy explains how we collect, use, and protect your data.

## 2. Data We Collect

### Account Data
- Business name, email address, hashed password

### Transaction Data
- Coin purchase history and wallet balance

### Usage Data
- AI-generated responses and conversation history
- Product catalogue and knowledge base content you upload

### Technical Data
- IP address, browser type, and access timestamps (server logs)

## 3. How We Use Your Data
We use your data to:
- Provide and improve the Wakalabot service
- Process coin-based billing for platform usage
- Generate AI responses on your behalf using your knowledge base
- Provide customer support and respond to your enquiries
- Send important service notifications (no marketing without consent)

## 4. Data Sharing
We do **not** sell your personal data. We share data only with:
- **Groq / OpenAI**: For AI inference (messages are processed but not stored by these providers beyond their standard retention periods)
- **Cloudinary**: For image storage if you upload product images
- Law enforcement, when required by Tanzanian law

## 5. Data Storage & Security
- Data is stored in encrypted PostgreSQL databases
- Passwords are hashed using bcrypt with SHA-256 pre-hashing
- Access tokens are stored encrypted at rest
- We use industry-standard TLS encryption for data in transit
- We perform regular security audits

## 6. Your Rights Under PDPA 2022
Under the Personal Data Protection Act, 2022, you have the right to:
- **Access**: Request a copy of the personal data we hold about you
- **Rectification**: Request correction of inaccurate data
- **Erasure**: Request deletion of your data (subject to legal obligations)
- **Portability**: Receive your data in a structured, machine-readable format
- **Objection**: Object to certain types of processing

To exercise these rights, contact us at **privacy@wakalabot.com**.

## 7. Data Retention
We retain your data for as long as your account is active. Upon account termination:
- Account data is deleted within 30 days
- Transaction records are retained for 7 years as required by Tanzanian financial regulations
- Conversation logs are deleted within 30 days unless you request otherwise

## 8. Cookies
We use only essential session cookies required for authentication. We do not use tracking or advertising cookies.

## 9. Children's Privacy
The Service is not directed at persons under 18 years of age. We do not knowingly collect personal data from minors.

## 10. Changes to This Policy
We will notify you of material changes to this Privacy Policy via email. Continued use of the Service after the effective date of changes constitutes acceptance.

## 11. Contact & Complaints
**Data Controller**: Wakalabot  
**Email**: privacy@wakalabot.com  
**Address**: Karagwe, Tanzania

If you believe your rights have been violated, you may lodge a complaint with the **Tanzania Personal Data Protection Commission**.

---
*Wakalabot — Accelerating Tanzanian and International businesses, from SMEs to large enterprises, using AI.*
`

// export default function PrivacyPolicy() {
//   return (
//     <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
//       {/* Header */}
//       <header className="border-b border-gray-800 bg-gray-900">
//         <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
//           <Link to="/" className="flex items-center gap-2 text-xl font-bold text-white">
//             <div className="w-8 h-8 rounded-lg bg-[#6366f1] flex items-center justify-center text-white text-sm font-bold">W</div>
//             WakalaBot
//           </Link>
//           <Link to="/login" className="text-sm text-gray-400 hover:text-white transition-colors">
//             Back to App →
//           </Link>
//         </div>
//       </header>

//       {/* Content */}
//       <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12">
//         <div className="prose prose-invert prose-headings:text-white prose-p:text-gray-300 prose-li:text-gray-300 prose-a:text-[#6366f1] max-w-none">
//           <ReactMarkdown>{PRIVACY_CONTENT}</ReactMarkdown>
//         </div>
//       </main>

//       <Footer />
//     </div>
//   )
// }


export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-white">
            <div className="w-8 h-8 rounded-lg bg-[#6366f1] flex items-center justify-center text-white text-sm font-bold">W</div>
            WakalaBot
          </Link>
          <Link to="/login" className="text-sm text-gray-400 hover:text-white transition-colors">
            Back to App →
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12">
        <div className="max-w-none">
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
            {PRIVACY_CONTENT}
          </ReactMarkdown>
        </div>
      </main>

      <Footer />
    </div>
  )
}
