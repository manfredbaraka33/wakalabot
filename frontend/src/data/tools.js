import { Receipt, MessageSquareText, Calculator, TrendingUp, FileText, Sparkles } from 'lucide-react'

export const TOOLS = [
  {
    path: '/tools/price-list',
    title: 'Orodha ya Bei',
    desc: 'Picha nzuri ya bidhaa na bei zako kwa WhatsApp Status.',
    icon: Receipt,
    iconBg: 'bg-indigo-500/15',
    iconColor: 'text-indigo-400',
  },
  {
    path: '/tools/broadcast',
    title: 'Ujumbe wa Broadcast',
    desc: 'Ujumbe wa kuvutia wa WhatsApp, tayari kutumwa.',
    icon: MessageSquareText,
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
  },
  {
    path: '/tools/receipt',
    title: 'Risiti na Invoice',
    desc: 'Risiti ya kitaalamu kwa mteja, kama ya dukani.',
    icon: FileText,
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-400',
  },
  {
    path: '/tools/margin-calculator',
    title: 'Kikokotoo cha Faida',
    desc: 'Jua faida yako halisi au bei ya kuuza.',
    icon: TrendingUp,
    iconBg: 'bg-sky-500/15',
    iconColor: 'text-sky-400',
  },
    {
    path: '/tools/product-ad',
    title: 'Tangazo la Bidhaa',
    desc: 'Piga picha ya bidhaa, pata tangazo tayari la Instagram na WhatsApp Status.',
    icon: Sparkles,
    iconBg: 'bg-fuchsia-500/15',
    iconColor: 'text-fuchsia-400',
    isNew: true,
  },
  {
    path: '/tools/fee-calculator',
    title: 'Gharama za Mobile Money',
    desc: 'Linganisha M-Pesa, Tigo Pesa, Airtel Money na HaloPesa.',
    icon: Calculator,
    iconBg: 'bg-rose-500/15',
    iconColor: 'text-rose-400',
    // Flip to false only AFTER you verify each operator's official tariff.
    soon: true,
  },
  
]