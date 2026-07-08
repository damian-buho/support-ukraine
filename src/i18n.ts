// SPDX-FileCopyrightText: 2026 Damián Búho <damian.buho@proton.me>
//
// SPDX-License-Identifier: MIT

import type { Charity, LocaleMessages } from './types.js'
import { localeLoaders, resolveLocale, RTL_LOCALES, type SupportedLocale } from './locales/index.js'

export type { SupportedLocale } from './locales/index.js'

/** Cached loaded locale messages per language code. */
const cache = new Map<string, LocaleMessages>()

/**
 * Detect the user's preferred locale from browser APIs.
 *
 * Resolution order:
 * 1. Explicit `locale` option
 * 2. First match from `navigator.languages[]` (user-ordered preference list)
 * 3. `navigator.language` base tag (e.g. "es" from "es-MX")
 * 4. Fallback: "en"
 */
export function detectLocale(preferred?: string): SupportedLocale {
  if (preferred) {
    return resolveLocale(preferred)
  }

  if (typeof navigator !== 'undefined' && navigator.languages) {
    for (const tag of navigator.languages) {
      const resolved = resolveLocale(tag)
      if (resolved !== 'en') {
        return resolved
      }
    }
  }

  if (typeof navigator !== 'undefined' && navigator.language) {
    const resolved = resolveLocale(navigator.language)
    if (resolved !== 'en') {
      return resolved
    }
  }

  return 'en'
}

/**
 * Load locale messages for the given language code.
 * Returns cached result on repeat calls. Falls back to 'en' on error.
 */
export async function loadLocale(lang: string): Promise<LocaleMessages> {
  const code = resolveLocale(lang)

  const cached = cache.get(code)
  if (cached) {
    return cached
  }

  try {
    const loaded = await localeLoaders[code]!()
    cache.set(code, loaded.default)
    return loaded.default
  } catch {
    if (code !== 'en') {
      return loadLocale('en')
    }
    // EN should never fail — it is bundled inline
    throw new Error(`[support-ukraine] Failed to load locale "${code}"`)
  }
}

/**
 * Merge base charities with locale-specific translations.
 *
 * For each charity: use the locale tagline if available, otherwise keep
 * the English default from the base data.
 */
export function mergeCharities(base: readonly Charity[], locale: LocaleMessages): Charity[] {
  return base.map(charity => {
    const translated = locale.charities[charity.id]
    if (translated?.tagline) {
      return { ...charity, tagline: translated.tagline }
    }
    return charity
  })
}

/** Returns true if the locale uses right-to-left script. */
export function isRTL(lang: string): boolean {
  const code = resolveLocale(lang)
  return RTL_LOCALES.includes(code as 'ar')
}

/**
 * Build a translated banner text line for a charity.
 *
 * @returns The formatted string "UA_FLAG supportUkraine: name: tagline"
 */
export function formatBannerText(charity: Charity, messages: LocaleMessages): string {
  return `\u{1F1FA}\u{1F1E6} ${messages.supportUkraine}: ${charity.name}: ${charity.tagline}`
}

/**
 * Eagerly pre-load the English locale so it is always available synchronously.
 * Other locales are loaded on demand via `loadLocale()`.
 */
export async function preloadDefault(): Promise<LocaleMessages> {
  return loadLocale('en')
}
