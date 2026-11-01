// Duenne Huelle um localStorage: darf nie werfen, die App funktioniert auch ohne Cache.

const PREFIX = 'crack:'

export function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeCache(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Speicher voll oder gesperrt: dann eben ohne Cache.
  }
}

export function clearAllCaches(): void {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(PREFIX))
      .forEach((key) => localStorage.removeItem(key))
  } catch {
    // Nichts zu tun.
  }
}
