export const SIZES = [
  { id: 'square', name: 'Post', note: 'Instagram, Facebook (1:1)', w: 1080, h: 1080 },
  { id: 'portrait', name: 'Wima', note: 'Instagram wima (4:5)', w: 1080, h: 1350 },
  { id: 'a4', name: 'A4', note: 'Karatasi, chapisha flyer', w: 1080, h: 1527 },
  { id: 'story', name: 'Story', note: 'WhatsApp Status (9:16)', w: 1080, h: 1920 },
]

export function aspectOf(id) {
  const s = SIZES.find((x) => x.id === id) || SIZES[0]
  return `${s.w} / ${s.h}`
}