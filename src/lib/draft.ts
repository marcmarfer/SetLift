const key = (sessionId: string) => `setlift:draft:${sessionId}`

export function readDraft<T>(sessionId: string): T | null {
  try {
    const stored = localStorage.getItem(key(sessionId))
    return stored ? (JSON.parse(stored) as T) : null
  } catch {
    return null
  }
}

export function writeDraft(sessionId: string, value: unknown) {
  try {
    localStorage.setItem(key(sessionId), JSON.stringify(value))
  } catch {
    return
  }
}

export function forgetDraft(sessionId: string) {
  try {
    localStorage.removeItem(key(sessionId))
  } catch {
    return
  }
}
