import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import WakalaLogo from '../components/Wakalalogo'

const PRIVACY_SW = `
# Sera ya Faragha

*Ilisasishwa: Juni 30, 2026*

## 1. Utangulizi
Wakalabot ("sisi", "yetu") tunajitolea kulinda taarifa zako binafsi kulingana na **Sheria ya Ulinzi wa Taarifa Binafsi, 2022 (PDPA 2022)** ya Jamhuri ya Muungano wa Tanzania. Sera hii inaeleza jinsi tunavyokusanya, kutumia, na kulinda taarifa zako.

## 2. Taarifa Tunazokusanya

### Taarifa za Akaunti (Wafanyabiashara)
- Username, jina la biashara, neno la siri lililofichwa (hashed)
- Namba ya simu na barua pepe (si lazima)
- Logo ya biashara unayopakia

### Taarifa za Malipo
- Historia ya manunuzi ya coins na subscription
- Salio la wallet

### Taarifa za Matumizi
- Maudhui ya Knowledge Base na bidhaa unazoweka
- Mazungumzo kati ya AI yako na wateja wako
- Namba za simu za wateja wanaochati nawe (zinazokusanywa kupitia OTP verification)

### Taarifa za Kiufundi
- Namba ya IP, aina ya kivinjari, na muda wa kuingia (server logs)

## 3. Jinsi Tunavyotumia Taarifa Zako
Tunatumia taarifa zako kwa:
- Kutoa na kuboresha huduma ya Wakalabot
- Kuthibitisha namba za simu za wateja kupitia SMS OTP
- Kushughulikia bili za coins na subscription
- Kuzalisha majibu ya AI kwa niaba yako kutumia Knowledge Base yako
- Kutuma SMS za arifa muhimu (lead mpya, malipo yamekubaliwa, salio limepungua)
- Kutoa msaada wa Support

## 4. Ushirikiano wa Taarifa
**Hatuziuzi** taarifa zako binafsi. Tunashirikiana taarifa tu na:
- **Google Gemini**: Kwa AI inference (ujumbe unachakatwa lakini haujahifadhiwa na Google zaidi ya muda wao wa kawaida wa uhifadhi)
- **Cloudinary**: Kwa kuhifadhi picha za bidhaa na logo unazopakia
- **NextSMS**: Kwa kutuma SMS za OTP na arifa kwa namba yako ya simu
- Vyombo vya sheria, pale sheria ya Tanzania inapohitaji

## 5. Uhifadhi na Usalama wa Taarifa
- Taarifa zinahifadhiwa kwenye database za PostgreSQL zilizofichwa (encrypted)
- Maneno ya siri yanafichwa kwa bcrypt na SHA-256 pre-hashing
- Tunatumia TLS encryption ya kiwango cha juu kwa taarifa zinazosafiri
- Mazungumzo na taarifa za wateja zinahifadhiwa muda akaunti yako ikiwa hai

## 6. Haki Zako Chini ya PDPA 2022
Chini ya Sheria ya Ulinzi wa Taarifa Binafsi, 2022, una haki ya:
- **Kufikia**: Kuomba nakala ya taarifa binafsi tunazoshikilia kuhusu wewe
- **Kusahihisha**: Kuomba kurekebishwa kwa taarifa zisizo sahihi
- **Kufutwa**: Kuomba taarifa zako zifutwe (kulingana na wajibu wa kisheria)
- **Kuhamishwa**: Kupokea taarifa zako kwa muundo unaosomeka kwa mashine
- **Kupinga**: Kupinga aina fulani za uchakataji wa taarifa zako

Kutumia haki hizi, wasiliana nasi: **info@wakalabot.co.tz**

## 7. Muda wa Kuhifadhi Taarifa
Tunahifadhi taarifa zako muda akaunti yako ikiwa hai. Baada ya kusitisha akaunti:
- Taarifa za akaunti zinafutwa ndani ya siku 30
- Rekodi za malipo zinahifadhiwa kwa miaka 7 kama sheria za kifedha za Tanzania zinavyohitaji
- Mazungumzo ya wateja yanafutwa ndani ya siku 30 isipokuwa uombe vinginevyo

## 8. Cookies
Tunatumia cookies muhimu tu zinazohitajika kwa kuthibitisha utambulisho (authentication). Hatutumii cookies za ufuatiliaji au matangazo.

## 9. Faragha ya Watoto
Huduma hii haijaelekezwa kwa watu chini ya miaka 18. Hatukusanyi kwa makusudi taarifa binafsi za watoto.

## 10. Mabadiliko ya Sera Hii
Tutakuarifu kuhusu mabadiliko makubwa ya Sera hii kupitia SMS au arifa ya dashibodi. Kuendelea kutumia Huduma baada ya mabadiliko kunamaanisha umekubali.

## 11. Mawasiliano na Malalamiko
**Mdhibiti wa Taarifa**: Wakalabot
**Barua pepe**: info@wakalabot.co.tz
**WhatsApp**: +255 712 750 468
**Mahali**: Karagwe, Tanzania

Kama unaamini haki zako zimekiukwa, unaweza kuwasilisha malalamiko kwa **Tume ya Ulinzi wa Taarifa Binafsi ya Tanzania**.

---
*Wakalabot — Tunasaidia wafanyabiashara wa Tanzania kuhudumia wateja kwa AI, kwa Kiswahili.*
`

const PRIVACY_EN = `
# Privacy Policy

*Last updated: June 30, 2026*

## 1. Introduction
Wakalabot ("we", "us", "our") is committed to protecting your personal information in accordance with the **Personal Data Protection Act, 2022 (PDPA 2022)** of the United Republic of Tanzania. This Privacy Policy explains how we collect, use, and protect your data.

## 2. Data We Collect

### Account Data (Merchants)
- Username, business name, hashed password
- Phone number and email address (optional)
- Business logo you upload

### Transaction Data
- Coin purchase and subscription history
- Wallet balance

### Usage Data
- Knowledge Base content and products you add
- Conversations between your AI agent and your customers
- Customer phone numbers (collected via SMS OTP verification)

### Technical Data
- IP address, browser type, and access timestamps (server logs)

## 3. How We Use Your Data
We use your data to:
- Provide and improve the Wakalabot service
- Verify customer phone numbers via SMS OTP
- Process coin and subscription billing
- Generate AI responses on your behalf using your Knowledge Base
- Send important SMS notifications (new leads, payment approvals, low balance alerts)
- Provide customer support

## 4. Data Sharing
We do **not** sell your personal data. We share data only with:
- **Google Gemini**: for AI inference (messages are processed but not stored by Google beyond their standard retention periods)
- **Cloudinary**: for storing product images and logos you upload
- **NextSMS**: for delivering OTP and notification SMS to your phone number
- Law enforcement, when required by Tanzanian law

## 5. Data Storage & Security
- Data is stored in encrypted PostgreSQL databases
- Passwords are hashed using bcrypt with SHA-256 pre-hashing
- We use industry-standard TLS encryption for data in transit
- Conversations and customer data are retained while your account remains active

## 6. Your Rights Under PDPA 2022
Under the Personal Data Protection Act, 2022, you have the right to:
- **Access**: request a copy of the personal data we hold about you
- **Rectification**: request correction of inaccurate data
- **Erasure**: request deletion of your data (subject to legal obligations)
- **Portability**: receive your data in a structured, machine-readable format
- **Objection**: object to certain types of data processing

To exercise these rights, contact us at **info@wakalabot.co.tz**.

## 7. Data Retention
We retain your data for as long as your account remains active. Upon account termination:
- Account data is deleted within 30 days
- Transaction records are retained for 7 years as required by Tanzanian financial regulations
- Customer conversation logs are deleted within 30 days unless you request otherwise

## 8. Cookies
We use only essential session cookies required for authentication. We do not use tracking or advertising cookies.

## 9. Children's Privacy
The Service is not directed at persons under 18 years of age. We do not knowingly collect personal data from minors.

## 10. Changes to This Policy
We will notify you of material changes via SMS or a dashboard notification. Continued use of the Service after changes constitutes acceptance.

## 11. Contact & Complaints
**Data Controller**: Wakalabot
**Email**: info@wakalabot.co.tz
**WhatsApp**: +255 712 750 468
**Address**: Karagwe, Tanzania

If you believe your rights have been violated, you may lodge a complaint with the **Tanzania Personal Data Protection Commission**.

---
*Wakalabot — Helping Tanzanian businesses serve customers with AI, in Swahili.*
`

function LangToggle({ lang, setLang }) {
  return (
    <div className="inline-flex rounded-lg bg-gray-800 border border-gray-700 p-1 mb-8">
      <button
        onClick={() => setLang('sw')}
        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
          lang === 'sw' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
        }`}
      >
        Kiswahili
      </button>
      <button
        onClick={() => setLang('en')}
        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
          lang === 'en' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
        }`}
      >
        English
      </button>
    </div>
  )
}

export default function PrivacyPolicy() {
  const [lang, setLang] = useState('sw')

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-white">
            <WakalaLogo />
          </Link>
          <Link to="/signin" className="text-sm text-gray-400 hover:text-white transition-colors">
            {lang === 'sw' ? 'Rudi Kwenye App →' : 'Back to App →'}
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12">
        <LangToggle lang={lang} setLang={setLang} />
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
              strong: ({ ...props }) => <strong className="text-white font-semibold" {...props} />,
            }}
          >
            {lang === 'sw' ? PRIVACY_SW : PRIVACY_EN}
          </ReactMarkdown>
        </div>
      </main>

      <Footer />
    </div>
  )
}