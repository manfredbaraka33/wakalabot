import { Download, Share2 } from 'lucide-react'
import { downloadImage, shareImage } from '../utils/toolApi'

export default function ImageResult({ url, filename, maxWidth = 'max-w-sm' }) {
  const canShare = typeof navigator !== 'undefined' && !!navigator.share
  return (
    <div className="mt-6 bg-gray-900 border border-indigo-500/30 rounded-2xl p-5 space-y-4">
      <img src={url} alt="Matokeo" className={`w-full ${maxWidth} mx-auto rounded-xl`} />
      <div className="flex gap-2">
        {canShare && (
          <button
            onClick={() => shareImage(url, filename)}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            <Share2 className="w-4 h-4" /> Tuma WhatsApp
          </button>
        )}
        <button
          onClick={() => downloadImage(url, filename)}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-gray-800 border border-gray-700 hover:border-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition-colors"
        >
          <Download className="w-4 h-4" /> Pakua
        </button>
      </div>
    </div>
  )
}