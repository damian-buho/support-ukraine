// SPDX-FileCopyrightText: 2026 Damián Búho <damian.buho@proton.me>
//
// SPDX-License-Identifier: MIT

import type { LocaleMessages } from './types.js'
import { loaderFor, resolveLocale, type SupportedLocale } from './locales/index.js'

export type { SupportedLocale } from './locales/index.js'
export { mergeCharities, isRTL, formatBannerText } from './banner.js'

// Locale every visitor falls back to.
const FALLBACK_LOCALE: SupportedLocale = 'en'

/**
Cached loaded locale messages per language code.
*/
const cache = new Map<string, LocaleMessages>()

// @internal — test helper resetting the memoized locale messages.
export function resetLocaleCache(): void {
  cache.clear()
}

/**
Detect the user's preferred locale from browser APIs.

Resolution order:
1. Explicit `locale` option
2. First match from `navigator.languages[]` (user-ordered preference list)
3. `navigator.language` base tag (e.g. "es" from "es-MX")
4. Fallback: "en"
*/
export function detectLocale(preferred?: string): SupportedLocale {
  if (preferred) {
    return resolveLocale(preferred)
  }

  if (typeof navigator !== 'undefined' && navigator.languages) {
    for (const tag of navigator.languages) {
      const resolved = resolveLocale(tag)
      if (resolved !== FALLBACK_LOCALE) {
        return resolved
      }
    }
  }

  return typeof navigator !== 'undefined' && navigator.language
    ? resolveLocale(navigator.language)
    : FALLBACK_LOCALE
}

// Loads the messages of a locale code, memoizing the result.
async function loadMessages(code: SupportedLocale): Promise<LocaleMessages> {
  const cached = cache.get(code)
  if (cached) {
    return cached
  }

  const loaded = await loaderFor(code)()
  const messages = loaded.default as LocaleMessages
  cache.set(code, messages)
  return messages
}

/**
Load locale messages for the given language code.
Returns cached result on repeat calls. Falls back to 'en' on error.
*/
export async function loadLocale(lang: string): Promise<LocaleMessages> {
  const code = resolveLocale(lang)

  try {
    return await loadMessages(code)
  } catch {
    if (code === FALLBACK_LOCALE) {
      throw new Error(`[support-ukraine] Failed to load locale "${code}"`)
    }
    return loadMessages(FALLBACK_LOCALE)
  }
}

/**
Eagerly pre-load the English locale so it is always available synchronously.
Other locales are loaded on demand via `loadLocale()`.
*/
export async function preloadDefault(): Promise<LocaleMessages> {
  return loadMessages(FALLBACK_LOCALE)
}
