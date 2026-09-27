export const TECHNIQUE_MAX = 24

export interface TechniqueDraft {
  pause: boolean
  pauseSec: number
  tempo: boolean
  tempoSec: number
  custom: boolean
  text: string
}

export const SECONDS_RANGE = { min: 1, max: 10 }

const PAUSE = /^pausa\s+(\d+)\s*s$/i
const TEMPO = /^tempo\s+(\d+)\s*s$/i
const TEMPO_LEGACY = /^tempo\s+(\d)-(\d)-0$/i

export function readTechnique(value: string | null | undefined): TechniqueDraft {
  const draft: TechniqueDraft = { pause: false, pauseSec: 2, tempo: false, tempoSec: 3, custom: false, text: '' }
  const rest: string[] = []

  for (const part of (value ?? '').split('+').map((item) => item.trim()).filter(Boolean)) {
    const pause = part.match(PAUSE)
    const tempo = part.match(TEMPO)
    const legacy = part.match(TEMPO_LEGACY)

    if (pause) Object.assign(draft, { pause: true, pauseSec: Number(pause[1]) })
    else if (tempo) Object.assign(draft, { tempo: true, tempoSec: Number(tempo[1]) })
    else if (legacy) {
      Object.assign(draft, { tempo: true, tempoSec: Number(legacy[1]) })
      if (Number(legacy[2]) > 0) Object.assign(draft, { pause: true, pauseSec: Number(legacy[2]) })
    } else rest.push(part)
  }

  if (rest.length) Object.assign(draft, { custom: true, text: rest.join(' + ') })
  return draft
}

export function writeTechnique(draft: TechniqueDraft): string | null {
  const parts = [
    draft.tempo ? `tempo ${draft.tempoSec}s` : '',
    draft.pause ? `pausa ${draft.pauseSec}s` : '',
    draft.custom ? draft.text.trim().slice(0, TECHNIQUE_MAX) : '',
  ].filter(Boolean)

  if (parts.length === 0) return null
  const joined = parts.join(' + ')
  return joined.charAt(0).toUpperCase() + joined.slice(1)
}

export const sameTechnique = (a: string | null | undefined, b: string | null | undefined) =>
  (a?.trim().toLowerCase() || null) === (b?.trim().toLowerCase() || null)
