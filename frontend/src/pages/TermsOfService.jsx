import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import WakalaLogo from '../components/Wakalalogo'

const TERMS_SW = `
# Masharti ya Huduma

*Yalisasishwa: September 09, 2026*

## 1. Kukubali Masharti
Kwa kutumia Wakalabot ("Huduma"), unakubali kufungwa na Masharti haya ya Huduma na sheria zote zinazotumika za Jamhuri ya Muungano wa Tanzania.

## 2. Maelezo ya Huduma
Wakalabot ni jukwaa la AI linalosaidia biashara na taasisi za Tanzania kujibu wateja au wageni kiotomatiki kupitia chati ya wavuti, QR code, na widget inayowekwa kwenye website. Huduma ina aina mbili: bot ya kibiashara (inayohusisha bidhaa, huduma, na leads) na bot ya taarifa tu (majibu ya maswali bila mauzo). Huduma inajumuisha usimamizi wa maudhui, knowledge base, ufuatiliaji wa leads au maombi, na arifa za SMS.
## 3. Akaunti ya Mtumiaji
Unahitaji kufungua akaunti ya biashara kwa kutumia username, jina la biashara, na neno la siri ili kutumia Huduma. Namba ya simu na barua pepe si lazima lakini zinashauriwa kwa mawasiliano na arifa. Wewe ndiye unayehusika kuhifadhi siri ya akaunti yako na shughuli zote zinazofanyika chini ya akaunti hiyo.

## 4. Malipo na Bili
Huduma inatumia mfumo wa subscription pekee. Unachagua mpango — wa siku, wiki, mwezi, au miezi mitatu — wenye idadi maalum ya mazungumzo na muda maalum wa kutumika.

Bei zote ziko kwa Shilingi za Tanzania (TZS). Malipo yanayofanyika kwa M-Pesa au njia nyingine za simu yanathibitishwa na admin kabla ya mpango kuwashwa. Mpango ukiisha muda au mazungumzo yake kuisha, bot yako itasimama kufanya kazi mpaka utakaponunua mpango mpya. Malipo ya subscription hayarudishwi isipokuwa kama sheria inahitaji hivyo.
## 5. Matumizi Yanayokubalika
Unakubali kutotumia Huduma kwa:
- Kutuma spam au ujumbe usiotakiwa
- Kukiuka sheria yoyote ya Tanzania au kimataifa
- Kuvunja haki za kiakili (intellectual property) za wengine
- Kueneza malware au shughuli yoyote yenye madhara
- Kutoa namba za simu za uongo wakati wa usajili wa wateja (OTP verification)

## 6. Taarifa na Faragha
Matumizi yako ya Huduma pia yanaongozwa na [Sera yetu ya Faragha](/privacy). Kwa kutumia Huduma, unakubali ukusanyaji na matumizi ya taarifa zako kama ilivyoelezwa humo.

## 7. Maudhui Unayoweka (Knowledge Base na Bidhaa)
Wewe pekee unahusika na usahihi wa taarifa za bidhaa, bei, na maudhui mengine unayoweka kwenye Knowledge Base yako. Wakalabot haihakiki usahihi wa maudhui haya — AI inajibu wateja kulingana na ulichoweka.

## 8. Haki za Kiakili
Huduma na maudhui yake asilia (msimbo, design, jina la chapa) ni mali ya Wakalabot na yamelindwa na sheria za haki za kiakili zinazotumika.

## 9. Kikomo cha Dhima
Kwa kiwango cha juu kinachokubalika kisheria, Wakalabot haitawajibika kwa hasara yoyote isiyo ya moja kwa moja, ya bahati mbaya, maalum, au ya ziada inayotokana na matumizi yako ya Huduma — ikiwa ni pamoja na hasara ya mauzo kutokana na majibu ya AI yasiyo sahihi.

## 10. Kusitisha Akaunti
Tunahifadhi haki ya kusitisha au kuzuia akaunti yako kwa uamuzi wetu endapo utakiuka Masharti haya. Unaweza kusitisha akaunti yako wakati wowote kwa kuwasiliana na timu ya Support.

## 11. Sheria Inayotumika
Masharti haya yanaongozwa na sheria za Jamhuri ya Muungano wa Tanzania.

## 12. Mabadiliko ya Masharti
Tunahifadhi haki ya kubadilisha Masharti haya wakati wowote. Mabadiliko makubwa yatatangazwa kupitia arifa kwenye dashibodi yako au SMS. Kuendelea kutumia Huduma baada ya mabadiliko kunamaanisha umekubali Masharti mapya.

## 13. Mawasiliano
Kwa maswali kuhusu Masharti haya, wasiliana nasi:
**Barua pepe**: info@wakalabot.co.tz
**WhatsApp**: +255 712 750 468

---
*Wakalabot — Tunasaidia wafanyabiashara wa Tanzania kuhudumia wateja kwa AI, kwa Kiswahili.*
`

const TERMS_EN = `
# Terms of Service

*Last updated: June 30, 2026*

## 1. Acceptance of Terms
By accessing or using Wakalabot ("the Service"), you agree to be bound by these Terms of Service and all applicable laws of the United Republic of Tanzania.

## 2. Description of Service
Wakalabot is an AI platform that helps Tanzanian businesses and organizations respond to customers or visitors automatically via web chat, QR code, and an embeddable website widget. The Service offers two modes: a commerce bot (products, services, and lead tracking) and an information-only bot (answers questions without selling anything). The Service includes content management, a knowledge base, lead or inquiry tracking, and SMS notifications.

## 3. User Accounts
You must register a business account using a username, business name, and password to use the Service. Phone number and email are optional but recommended for contact and notifications. You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account.

## 4. Payment & Billing
The Service operates on a subscription-only model. You choose a plan — daily, weekly, monthly, or quarterly — with a fixed message allowance and a fixed duration.

All pricing is in Tanzanian Shillings (TZS). Payments made via M-Pesa or other mobile channels are verified by an administrator before a plan is activated. When a plan expires or its message allowance is used up, your bot stops responding until a new plan is purchased. Subscription payments are non-refundable except as required by applicable law.
## 5. Acceptable Use
You agree not to use the Service to:
- Send spam or unsolicited messages
- Violate any applicable Tanzanian or international law
- Infringe on the intellectual property rights of others
- Distribute malware or engage in any harmful activity
- Provide false phone numbers during customer OTP verification

## 6. Data & Privacy
Your use of the Service is also governed by our [Privacy Policy](/privacy). By using the Service, you consent to the collection and use of your data as described therein.

## 7. Content You Provide (Knowledge Base & Products)
You are solely responsible for the accuracy of product, pricing, and other content you add to your Knowledge Base. Wakalabot does not verify the accuracy of this content — the AI responds to customers based on what you provide.

## 8. Intellectual Property
The Service and its original content, features, and branding are owned by Wakalabot and protected by applicable intellectual property laws.

## 9. Limitation of Liability
To the maximum extent permitted by law, Wakalabot shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service — including lost sales resulting from inaccurate AI responses.

## 10. Termination
We reserve the right to suspend or terminate your account at our discretion if you violate these Terms. You may terminate your account at any time by contacting Support.

## 11. Governing Law
These Terms are governed by the laws of the United Republic of Tanzania.

## 12. Changes to Terms
We reserve the right to modify these Terms at any time. Material changes will be announced via a dashboard notification or SMS. Continued use of the Service after changes constitutes acceptance of the new Terms.

## 13. Contact
For questions about these Terms, contact us:
**Email**: info@wakalabot.co.tz
**WhatsApp**: +255 712 750 468

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

export default function TermsOfService() {
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
            {lang === 'sw' ? TERMS_SW : TERMS_EN}
          </ReactMarkdown>
        </div>
      </main>

      <Footer />
    </div>
  )
}