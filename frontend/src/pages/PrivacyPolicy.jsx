import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import WakalaLogo from '../components/Wakalalogo'

const PRIVACY_SW = `
# Sera ya Faragha

*Yalisasishwa: Oktoba 23, 2026*

Sera hii inaeleza jinsi Wakalabot inavyokusanya, kutumia na kulinda taarifa zako kwenye huduma zetu mbili: **Wakalabot** (msaidizi wa AI wa kujibu wateja) na **Wakalabot Studio** (matangazo na orodha za bei). Tunazingatia Sheria ya Ulinzi wa Taarifa Binafsi ya Tanzania ya mwaka 2022.

## 1. Sisi ni Nani
Wakalabot, Karagwe, Tanzania. Kwa taarifa za akaunti za wafanyabiashara na watumiaji wa Studio, sisi ndio wadhibiti wa data. Kwa mazungumzo ya wateja wanaochati na bot ya mfanyabiashara, mfanyabiashara ndiye mdhibiti wa data na sisi tunachakata kwa niaba yake.

## 2. Taarifa Tunazokusanya
### Akaunti ya Wakalabot (mfanyabiashara au taasisi)
- Username, jina la biashara, na neno la siri (linahifadhiwa kwa hashing; hatuwezi kulisoma)
- Namba ya simu na barua pepe (si lazima)
- Bidhaa, huduma, maelezo, masaa, mahali, picha na nembo unazoweka
- Historia ya mpango na malipo

### Watu wanaochati na bot ya mfanyabiashara
- Ujumbe wa mazungumzo
- Jina na namba ya simu ikiwa umejisajili, umethibitisha kwa OTP, au umeitoa kwa AI unapoomba kuwasiliana nawe
- Mgeni: kitambulisho cha muda kwenye kivinjari chako

### Akaunti ya Studio
- Namba ya simu (imethibitishwa kwa SMS), username na neno la siri (hashing)
- Jina la biashara, simu ya mawasiliano na rangi unayopenda (si lazima)
- Msimbo wa mwaliko, na chanzo kilichokuleta (kwa mfano tangazo au kiungo)
- Salio la credits na historia yake

### Maudhui ya Studio
- Picha unazopakia (bidhaa au nembo)
- Maandishi unayoandika: jina la bidhaa au huduma, bei, kichwa, ofa, jina la biashara, simu, na orodha za bei
- Matangazo na orodha zilizotengenezwa
- Rekodi ya kila kazi (aina, hali, gharama)

### Malipo
- Kiasi, pack uliyonunua na namba ya muamala (reference). Hatukusanyi PIN wala taarifa za kadi; malipo yanafanyika kwenye huduma ya pesa ya simu.

### Taarifa za kiufundi
- Anwani ya IP, aina ya kifaa na kivinjari, na kumbukumbu za usalama za seva
- Hifadhi ya ndani ya kivinjari (kwa kuingia, mapendeleo kama mwanga au giza, na kukumbuka chanzo cha kuingia)

## 3. Tunazitumiaje
- Kukupa huduma, kuthibitisha namba yako kwa SMS, kuchakata malipo, na kurudisha credits kazi ikishindwa
- Kutuma arifa muhimu (mfano lead mpya, mpango kuisha, malipo kukubaliwa)
- Usalama, kuzuia udanganyifu na matumizi mabaya
- Msaada kwa wateja na kuboresha huduma
- Kupima ni matangazo gani yanaleta watumiaji
- Kutii sheria

Hatuuzi taarifa zako. Hatutumii picha au kazi zako kutangaza bila ruhusa yako ya wazi.

## 4. Picha na Kazi za Studio
- Picha unazopakia zinachakatwa kwenye seva yetu. Nakala ya awali inafutwa mara kazi inapokamilika au ikishindwa. Tunaondoa taarifa za eneo (GPS) zilizo ndani ya picha.
- Kazi zilizokamilika zinahifadhiwa kwenye maktaba yako kwa siku 30, kisha faili zinafutwa kiotomatiki. Unaweza kuzifuta mapema wakati wowote.
- Hakuna ukurasa wa umma wa kazi zako. Unazifikia kwa kiungo cha muda mfupi kinachoisha ndani ya saa moja.
- Kwa sasa, matangazo na orodha za bei vinatengenezwa na programu yetu kwenye seva yetu, bila kutuma picha zako kwa watoa huduma wa AI. Tukianzisha vipengele vya AI (mfano mandhari za AI, video au sauti) kupitia watoa huduma wengine, tutasasisha sera hii na kukueleza kabla, na taarifa zako zitatumwa kwao pale tu unapochagua kipengele hicho.
- Maandishi ya kazi (jina la bidhaa, bei, jina la biashara na simu) yanabaki kwenye rekodi zetu hadi uifute kazi hiyo au akaunti yako.

## 5. Tunashiriki na Nani
Tunashiriki taarifa kiasi kinachohitajika tu na:
- **NextSMS**: kutuma SMS za uthibitisho na arifa (namba ya simu na ujumbe)
- **Google (Gemini)**: kuchakata mazungumzo ya bot ya Wakalabot
- **Cloudinary**: kuhifadhi picha na nembo za bot ya Wakalabot
- **DigitalOcean**: kuhifadhi mfumo wetu na data
- **Watoa huduma wa pesa za simu** (M-Pesa, Tigo Pesa, Airtel Money, na wa malipo ya kiotomatiki tutakapowaunganisha): kiasi na namba ya muamala
- **Meta**: ikiwa tumewasha zana za kupima matangazo (mfano Meta Pixel), taarifa za kutembelea kurasa zetu (si maudhui ya kazi zako) zinatumwa kwa Meta
- **Mamlaka za sheria**: pale tunapotakiwa kisheria

Baadhi ya watoa huduma wako nje ya Tanzania. Tunachagua watoa huduma wanaolinda taarifa na tunashiriki kiasi kinachohitajika tu.

## 6. Tunazihifadhi Kwa Muda Gani
- Akaunti na taarifa zake: hadi ufunge akaunti au uombe ifutwe
- Faili za Studio: siku 30
- Nambari za uthibitisho (OTP): zinahifadhiwa kwa hashing na zinaisha ndani ya dakika 10
- Rekodi za malipo na credits: miaka 7, kwa mahitaji ya kodi na uhasibu
- Kumbukumbu za usalama za seva: hadi siku 90
- Mazungumzo ya bot: kwa muda wa akaunti ya mfanyabiashara, ambaye anaweza kuyafuta

## 7. Usalama
Tunatumia HTTPS; neno la siri na nambari za uthibitisho vinahifadhiwa kwa hashing; kuna kikomo cha majaribio ya kuingia; viungo vya picha vinaisha muda; na ufikiaji wa data ni mdogo. Hakuna mfumo salama kwa asilimia 100. Ukigundua tatizo la usalama, tuandikie mara moja.

## 8. Haki Zako
Una haki ya kupata nakala ya taarifa zako, kuzisahihisha, kuzifuta, kupinga au kuzuia usindikaji, kuondoa ridhaa, na kulalamika kwa Tume ya Ulinzi wa Taarifa Binafsi.

Ili kutumia haki hizi au kufuta akaunti yako, tuandikie kupitia mawasiliano hapo chini. Tunajibu ndani ya siku 30. Tukifuta akaunti, tunafuta taarifa zako isipokuwa zile tunazotakiwa kuzihifadhi kisheria (mfano rekodi za malipo). Watumiaji wa Studio wanaweza pia kufuta kazi zao wenyewe ndani ya Studio.

## 9. Watoto
Huduma zetu si za watu walio chini ya miaka 18. Tukigundua tumekusanya taarifa za mtoto, tunazifuta.

## 10. Hifadhi ya Kivinjari na Vidakuzi
Tunatumia hifadhi ya ndani ya kivinjari kukumbuka kuingia kwako, mapendeleo yako na chanzo kilichokuleta. Tukiwasha zana za matangazo kama Meta Pixel, zinaweza kuweka vidakuzi; unaweza kuzizuia kwenye mipangilio ya kivinjari chako.

## 11. Mabadiliko ya Sera
Tukibadilisha sera hii, tutasasisha tarehe hapo juu na kukujulisha kwa mabadiliko makubwa.

## 12. Mawasiliano
- Barua pepe: info@wakalabot.co.tz
- WhatsApp: +255 712 750 468
- Anwani: Karagwe, Tanzania
`

const PRIVACY_EN = `
# Privacy Policy

*Last updated: October 23, 2026*

This policy explains how Wakalabot collects, uses and protects your information across our two services: **Wakalabot** (an AI assistant that answers customers) and **Wakalabot Studio** (ads and price lists). We aim to comply with Tanzania's Personal Data Protection Act, 2022.

## 1. Who We Are
Wakalabot, Karagwe, Tanzania. For the account data of businesses and Studio users, we are the data controller. For conversations between customers and a business's bot, the business is the data controller and we process the data on its behalf.

## 2. Information We Collect
### Wakalabot account (business or organization)
- Username, business name, and password (stored as a hash; we cannot read it)
- Phone number and email (optional)
- The products, services, descriptions, hours, location, images and logo you add
- Plan and payment history

### People chatting with a business's bot
- Conversation messages
- Name and phone number if you registered, verified by OTP, or gave it to the AI when asking to be contacted
- Guests: a temporary identifier in your browser

### Studio account
- Phone number (verified by SMS), username and password (hash)
- Business name, contact phone and preferred color (optional)
- Referral code, and the source that brought you (for example an ad or a link)
- Credit balance and its history

### Studio content
- Photos you upload (product or logo)
- Text you type: product or service name, price, headline, offer, business name, phone, and price lists
- The ads and lists that are generated
- A record of each job (type, status, cost)

### Payments
- Amount, the pack you bought, and the transaction reference. We do not collect PINs or card details; payments happen on the mobile money service.

### Technical information
- IP address, device and browser type, and server security logs
- Browser local storage (for sign-in, preferences such as light or dark mode, and remembering the source that brought you)

## 3. How We Use It
- To provide the services, verify your number by SMS, process payments, and refund credits when a job fails
- To send important alerts (for example a new lead, a plan ending, a payment approved)
- Security, fraud prevention and preventing abuse
- Customer support and improving the services
- Measuring which ads bring users
- Complying with the law

We do not sell your information. We do not use your photos or work to promote our service without your clear permission.

## 4. Studio Photos and Work
- Photos you upload are processed on our server. The original copy is deleted as soon as the job finishes or fails. We strip location (GPS) data from inside photos.
- Finished work is kept in your library for 30 days, then the files are deleted automatically. You can delete them sooner at any time.
- There is no public page for your work. You access it through a short-lived link that expires within an hour.
- At present, ads and price lists are generated by our own software on our own server, without sending your photos to AI providers. If we introduce AI features (for example AI backgrounds, video or voice) through other providers, we will update this policy and tell you beforehand, and your data will be sent to them only when you choose that feature.
- The text of a job (product name, price, business name and phone) stays in our records until you delete that job or your account.

## 5. Who We Share It With
We share only what is needed, with:
- **NextSMS**: sending verification and alert SMS (phone number and message)
- **Google (Gemini)**: processing Wakalabot bot conversations
- **Cloudinary**: storing Wakalabot bot images and logos
- **DigitalOcean**: hosting our system and data
- **Mobile money providers** (M-Pesa, Tigo Pesa, Airtel Money, and any automatic payment provider we connect): amount and transaction reference
- **Meta**: if we enable ad measurement tools (for example Meta Pixel), information about visits to our pages (not the content of your work) is sent to Meta
- **Authorities**: where we are required by law

Some providers are outside Tanzania. We choose providers that protect data and share only what is needed.

## 6. How Long We Keep It
- Account and its data: until you close the account or ask for deletion
- Studio files: 30 days
- Verification codes (OTP): stored as a hash and expire within 10 minutes
- Payment and credit records: 7 years, for tax and accounting
- Server security logs: up to 90 days
- Bot conversations: for the life of the business's account; the business can delete them

## 7. Security
We use HTTPS; passwords and verification codes are stored as hashes; sign-in attempts are rate-limited; image links expire; and access to data is limited. No system is 100 percent secure. If you find a security problem, please write to us immediately.

## 8. Your Rights
You have the right to get a copy of your data, correct it, delete it, object to or restrict processing, withdraw consent, and complain to the Personal Data Protection Commission.

To use these rights or to delete your account, write to us using the contacts below. We reply within 30 days. When we delete an account, we delete your data except what the law requires us to keep (for example payment records). Studio users can also delete their own jobs inside Studio.

## 9. Children
Our services are not for people under 18. If we discover we have collected a child's information, we delete it.

## 10. Browser Storage and Cookies
We use browser local storage to remember your sign-in, your preferences and the source that brought you. If we enable advertising tools such as Meta Pixel, they may set cookies; you can block them in your browser settings.

## 11. Changes to This Policy
If we change this policy, we will update the date above and tell you about significant changes.

## 12. Contact
- Email: info@wakalabot.co.tz
- WhatsApp: +255 712 750 468

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