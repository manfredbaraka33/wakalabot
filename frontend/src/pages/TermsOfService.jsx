import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import WakalaLogo from '../components/Wakalalogo'

const TERMS_SW = `
# Masharti ya Matumizi

*Yalisasishwa: Oktoba 23, 2026*

Karibu Wakalabot. Masharti haya yanaeleza haki na wajibu wako unapotumia huduma zetu mbili: **Wakalabot** (msaidizi wa AI wa kujibu wateja) na **Wakalabot Studio** (zana za kutengeneza matangazo na orodha za bei). Ukijisajili au kutumia huduma yoyote, unakubali masharti haya pamoja na [Sera ya Faragha](/privacy). Kama hukubali, tafadhali usitumie huduma.

## 1. Huduma Zetu
**Wakalabot** inamwezesha mfanyabiashara au taasisi kuweka taarifa zake (bidhaa, huduma, maudhui), kupata kiungo na QR code ya mazungumzo, na kupokea maombi ya wateja (leads) na arifa za SMS. Kuna aina mbili za bot: bot ya biashara (inayouza) na bot ya taarifa (inayojibu maswali tu).

**Wakalabot Studio** inakuwezesha kutengeneza matangazo ya picha na orodha za bei kwa miundo na rangi zetu, na kulipia kwa credits.

Tunaweza kuongeza, kubadilisha au kusimamisha vipengele (mfano video). Vipengele vipya vinaweza kuwa na masharti ya ziada yatakayoonyeshwa kabla hujavitumia.

## 2. Akaunti
- Lazima uwe na umri wa miaka 18 au zaidi.
- Wakalabot: unafungua akaunti kwa username na neno la siri. Studio: unathibitisha namba ya simu kwa SMS, kisha unaweka username na neno la siri. Namba moja ya simu ni akaunti moja ya Studio.
- Toa taarifa za kweli na uzisasishe. Linda neno lako la siri; shughuli zote kwenye akaunti yako ni jukumu lako.
- Usitengeneze akaunti nyingi ili kupata zawadi au matumizi ya bure mara nyingi.

## 3. Malipo
### 3.1 Wakalabot (subscription)
Wakalabot inatumia mpango wa muda maalum (siku, wiki, mwezi au miezi mitatu) wenye idadi maalum ya mazungumzo. Mpango ukiisha muda au mazungumzo yakiisha, bot inasimama hadi ununue mpango mpya. Malipo yanathibitishwa na timu yetu kabla mpango haujawashwa, na hayarudishwi isipokuwa sheria inahitaji hivyo.

### 3.2 Wakalabot Studio (credits)
- **Credits** ni salio la matumizi unalolipia mapema. Si pesa, si akiba ya benki, haziwezi kuhamishiwa kwa mtu mwingine, na hazibadilishwi kuwa fedha taslimu.
- Bei ya credits na kiasi kinachotumika kwa kila kazi vinaonyeshwa ndani ya Studio. Tunaweza kuvibadilisha; mabadiliko hayaathiri kazi iliyoshaanza.
- Malipo hufanyika kwa M-Pesa, Tigo Pesa au Airtel Money. Timu yetu inathibitisha muamala kabla ya kuongeza credits (kwa kawaida ndani ya dakika chache hadi masaa machache). Namba ya muamala (reference) inaweza kutumika mara moja tu. Tukiunganisha mtoa huduma wa malipo wa kiotomatiki, masharti yake yatatumika pia.
- Kazi ikishindwa kiufundi, credits zinarudishwa kiotomatiki. Credits ulizonunua hazirudishwi kwa fedha, isipokuwa sheria inahitaji hivyo au tumekutoza kimakosa.
- Credits za zawadi (za kujisajili, mwaliko au promosheni) hazina thamani ya fedha. Tunaweza kuziondoa kwenye akaunti zinazotumia vibaya.
- Kwa sasa credits hazina muda wa kuisha. Tukiweka muda, tutakujulisha angalau siku 30 kabla.

### 3.3 Matumizi ya bure na alama ya Wakalabot
Tunatoa idadi ndogo ya matangazo na orodha za bei za bure kwa siku (kiwango kinaweza kubadilika). Kazi hizi zina alama ndogo ya Wakalabot. Usiiondoe, usiifiche wala usiikate. Ukitaka kazi bila alama, tumia credits.

## 4. Maudhui Yako na Haki Zako
- Picha, nembo, maandishi na taarifa unazopakia ni mali yako ("Maudhui Yako"). Unathibitisha kuwa una haki ya kuzitumia na kuwa hazikiuki haki za mtu mwingine (hakimiliki, chapa, faragha).
- Unatupa ruhusa ndogo, isiyo ya kipekee, ya kuchakata Maudhui Yako ili kukutengenezea kazi na kuendesha huduma. Hatutatumia kazi zako kutangaza huduma yetu bila ruhusa yako ya wazi.
- Matangazo na orodha unazotengeneza unaweza kuzitumia kwa biashara yako, pamoja na matumizi ya kibiashara.
- Miundo, mpangilio, programu, jina na nembo ya Wakalabot ni mali yetu. Hairuhusiwi kuzinakili, kuziuza tena, kuvuta data kwa njia za kiotomatiki, au kutoa huduma shindani kwa kutumia mfumo wetu.

## 5. Matumizi Yanayokatazwa
Hairuhusiwi kutumia Wakalabot au Studio kwa:
- Jambo lolote lisilo halali, au kuhadaa wateja (bei za uongo, ofa zisizokuwepo, bidhaa zisizokuwepo).
- Maudhui ya ngono au uchi, ukatili, vitisho, chuki, unyanyasaji, au yanayowahusu watoto vibaya.
- Kuiga sura, sauti au utambulisho wa mtu halisi bila ruhusa yake.
- Siasa, kampeni za uchaguzi au propaganda.
- Bidhaa au huduma haramu, au zinazodhibitiwa kisheria bila vibali vinavyotakiwa (kwa mfano dawa na madai ya kiafya, vyakula na vipodozi vinavyodhibitiwa, pombe, tumbaku, silaha, huduma za fedha na uwekezaji).
- Mipango ya "pesa za haraka" au piramidi.
- Kukiuka hakimiliki au chapa za wengine, kuvunja usalama wa mfumo, au kuuzidishia mzigo kwa roboti.

Wewe ndiye unayewajibika kwa maudhui unayotengeneza na kuyachapisha, na kwa kufuata sheria za Tanzania zinazohusu matangazo na maudhui ya mtandaoni. Tunaweza kukagua maombi, kukataa au kufuta kazi, kusimamisha akaunti, na kutoa taarifa kwa mamlaka pale sheria inapohitaji.

## 6. Wakalabot Bot: Usahihi na Wajibu
- AI inaweza kukosea. Mfanyabiashara anawajibika kuhakikisha bidhaa, bei, sera na taarifa alizoweka ni sahihi na za sasa.
- Bot ya taarifa ya hospitali, kliniki au kituo cha afya haitoi ushauri wa matibabu. Kwa tatizo la kiafya au dharura, wasiliana na kituo cha afya au huduma za dharura.
- Mfanyabiashara ndiye anayewajibika kwa wateja wake na kwa maudhui anayoweka kwenye bot yake, pamoja na kufuata sheria za ulinzi wa taarifa binafsi kuhusu wateja hao.

## 7. Upatikanaji wa Huduma
Tunajitahidi huduma ipatikane kila wakati, lakini hatuahidi isikatike. Kunaweza kuwa na matengenezo au hitilafu. Pakua kazi zako unazozihitaji, kwa sababu faili za Studio zinafutwa kiotomatiki baada ya siku 30.

## 8. Kusimamisha na Kufunga Akaunti
Unaweza kuacha kutumia huduma wakati wowote na kuomba akaunti yako ifutwe (angalia [Sera ya Faragha](/privacy)). Tunaweza kusimamisha au kufunga akaunti ikiwa kuna ukiukaji wa masharti haya, udanganyifu wa malipo, hatari ya usalama, au amri ya kisheria. Akaunti ikifungwa kwa ukiukaji, credits zilizobaki hazirudishwi. Tukifunga akaunti bila ukiukaji wako, tutakurudishia thamani ya credits ulizonunua ambazo hukutumia.

## 9. Kanusho na Kikomo cha Dhima
Huduma zinatolewa "kama zilivyo". Hatuhakikishi kuwa matangazo yatakuletea mauzo. Kwa kiwango cha juu kinachoruhusiwa na sheria, hatuwajibiki kwa hasara zisizo za moja kwa moja, upotevu wa faida, mauzo au data. Dhima yetu yote kwako haitazidi kiasi ulicholipa kwa huduma husika katika miezi 3 kabla ya tukio. Hakuna kitu katika masharti haya kinachoondoa dhima ambayo sheria ya Tanzania haikuruhusu kuiondoa.

## 10. Fidia
Utatulinda dhidi ya madai, hasara na gharama zinazotokana na Maudhui Yako au ukiukaji wako wa masharti haya.

## 11. Sheria Inayotumika na Migogoro
Masharti haya yanaongozwa na sheria za Jamhuri ya Muungano wa Tanzania. Tafadhali tuambie kwanza tatizo lako ili tulitatue kwa mazungumzo. Isipowezekana, mahakama za Tanzania ndizo zitakazoamua.

## 12. Mabadiliko ya Masharti
Tukibadilisha masharti kwa kiasi kikubwa, tutakujulisha ndani ya huduma au kwa SMS, na kusasisha tarehe hapo juu. Ukiendelea kutumia huduma baada ya mabadiliko, unakubali masharti mapya.

## 13. Mawasiliano
- Barua pepe: info@wakalabot.co.tz
- WhatsApp: +255 712 750 468
- Anwani: Karagwe, Tanzania
`

const TERMS_EN = `
# Terms of Use

*Last updated: October 23, 2026*

Welcome to Wakalabot. These terms explain your rights and responsibilities when using our two services: **Wakalabot** (an AI assistant that answers customers) and **Wakalabot Studio** (tools for making ads and price lists). By signing up or using either service, you agree to these terms and to our [Privacy Policy](/privacy). If you do not agree, please do not use the services.

## 1. Our Services
**Wakalabot** lets a business or organization add its information (products, services, content), get a chat link and QR code, and receive customer requests (leads) and SMS alerts. There are two bot types: a commerce bot (sells) and an information bot (answers questions only).

**Wakalabot Studio** lets you create image ads and price lists using our designs and colors, paid for with credits.

We may add, change or suspend features (for example video). New features may carry extra terms that are shown before you use them.

## 2. Accounts
- You must be 18 or older.
- Wakalabot: you open an account with a username and password. Studio: you verify your phone number by SMS, then choose a username and password. One phone number is one Studio account.
- Give true information and keep it current. Protect your password; everything done through your account is your responsibility.
- Do not create several accounts to collect rewards or free usage repeatedly.

## 3. Payments
### 3.1 Wakalabot (subscriptions)
Wakalabot uses fixed-duration plans (daily, weekly, monthly or three-monthly) with a set number of conversations. When a plan expires or its conversations run out, the bot stops until you buy a new plan. Payments are verified by our team before a plan is activated and are non-refundable except where the law requires otherwise.

### 3.2 Wakalabot Studio (credits)
- **Credits** are prepaid usage balance. They are not money, not a bank deposit, cannot be transferred to anyone else, and cannot be exchanged for cash.
- The price of credits and the amount each job uses are shown inside Studio. We may change them; changes do not affect a job already started.
- Payment is by M-Pesa, Tigo Pesa or Airtel Money. Our team verifies the transaction before adding credits (usually within minutes to a few hours). A transaction reference can be used only once. If we connect an automatic payment provider, its terms will apply as well.
- If a job fails for technical reasons, the credits are refunded automatically. Credits you purchased are not refunded in cash, unless the law requires it or we charged you by mistake.
- Gift credits (signup, referral or promotions) have no cash value. We may remove them from accounts that abuse the service.
- Credits currently do not expire. If we introduce an expiry, we will tell you at least 30 days before.

### 3.3 Free usage and the Wakalabot mark
We offer a small number of free ads and price lists per day (the amount may change). These carry a small Wakalabot mark. Do not remove, hide or crop it. If you want work without the mark, use credits.

## 4. Your Content and Your Rights
- The photos, logos, text and information you upload belong to you ("Your Content"). You confirm that you have the right to use them and that they do not infringe anyone else's rights (copyright, trademark, privacy).
- You give us a limited, non-exclusive permission to process Your Content to create your work and run the service. We will not use your work to promote our service without your clear permission.
- You may use the ads and lists you create for your business, including commercial use.
- Wakalabot's designs, layouts, software, name and logo belong to us. You may not copy or resell them, scrape data by automated means, or offer a competing service built on our system.

## 5. Prohibited Use
You may not use Wakalabot or Studio for:
- Anything unlawful, or to deceive customers (false prices, offers that do not exist, products that do not exist).
- Sexual or nude content, violence, threats, hate, harassment, or content that harms children.
- Imitating the face, voice or identity of a real person without their permission.
- Politics, election campaigning or propaganda.
- Illegal products or services, or regulated ones without the required permits (for example medicines and health claims, regulated foods and cosmetics, alcohol, tobacco, weapons, financial and investment services).
- Get-rich-quick or pyramid schemes.
- Infringing others' copyright or trademarks, breaching system security, or overloading the system with bots.

You are responsible for the content you create and publish, and for complying with Tanzanian laws on advertising and online content. We may review requests, refuse or delete work, suspend accounts, and report to authorities where the law requires.

## 6. Wakalabot Bot: Accuracy and Responsibility
- AI can make mistakes. The business is responsible for making sure the products, prices, policies and information it adds are accurate and current.
- An information bot for a hospital, clinic or health facility does not give medical advice. For a health problem or emergency, contact a health facility or emergency services.
- The business is responsible for its own customers and for the content it puts in its bot, including compliance with personal data protection law regarding those customers.

## 7. Availability
We work to keep the services available, but we do not promise they will never be interrupted. There may be maintenance or faults. Download the work you need, because Studio files are deleted automatically after 30 days.

## 8. Suspension and Closure
You can stop using the services at any time and ask for your account to be deleted (see the [Privacy Policy](/privacy)). We may suspend or close an account for breach of these terms, payment fraud, a security risk, or a legal order. If an account is closed for breach, remaining credits are not refunded. If we close an account without a breach by you, we will refund the value of your unused purchased credits.

## 9. Disclaimer and Limit of Liability
The services are provided "as is". We do not guarantee that your ads will bring sales. To the maximum extent allowed by law, we are not liable for indirect losses or for loss of profit, sales or data. Our total liability to you will not exceed the amount you paid for the relevant service in the 3 months before the event. Nothing in these terms removes liability that Tanzanian law does not allow to be removed.

## 10. Indemnity
You will protect us against claims, losses and costs arising from Your Content or your breach of these terms.

## 11. Governing Law and Disputes
These terms are governed by the laws of the United Republic of Tanzania. Please tell us about your problem first so we can resolve it by discussion. If that is not possible, the courts of Tanzania will decide.

## 12. Changes to These Terms
If we make a significant change, we will tell you in the service or by SMS and update the date above. If you keep using the services after a change, you accept the new terms.

## 13. Contact
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