export const folded = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

export const matches = (text: string | undefined, term: string) => Boolean(text && folded(text).includes(term))
