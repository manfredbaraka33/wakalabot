const OPTIONS = [
  { id: 'giza', label: 'Giza', from: '#0b0b12', to: '#241b0a', accent: '#f5b731' },
  { id: 'zumaridi', label: 'Zumaridi', from: '#051c16', to: '#09382b', accent: '#34d399' },
  { id: 'machweo', label: 'Machweo', from: '#2e0e18', to: '#762614', accent: '#ff8a4c' },
  { id: 'safi', label: 'Safi', from: '#fafafd', to: '#e2e5f7', accent: '#4f46e5' },
]

export default function StylePicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {OPTIONS.map(o => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`rounded-xl p-1.5 border-2 transition-colors ${
            value === o.id ? 'border-indigo-400' : 'border-transparent hover:border-gray-700'
          }`}
        >
          <div
            className="h-12 rounded-lg flex items-end justify-end p-1.5"
            style={{ background: `linear-gradient(160deg, ${o.from}, ${o.to})` }}
          >
            <span className="w-4 h-4 rounded-full" style={{ backgroundColor: o.accent }} />
          </div>
          <p className="text-[11px] text-gray-400 mt-1">{o.label}</p>
        </button>
      ))}
    </div>
  )
}