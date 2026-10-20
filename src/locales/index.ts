// SPDX-FileCopyrightText: 2026 Damián Búho <damian.buho@proton.me>
//
// SPDX-License-Identifier: MIT

import { baseLanguage } from '../language.js'

// Loader that resolves the messages of one locale.
export type LocaleLoader = () => Promise<{ default: unknown }>

/**
Map of BCP 47 base language → dynamic import loader.
*/
export const localeLoaders = {
  en: () => import('./en.yaml'),
  es: () => import('./es.yaml'),
  fr: () => import('./fr.yaml'),
  de: () => import('./de.yaml'),
  pt: () => import('./pt.yaml'),
  it: () => import('./it.yaml'),
  pl: () => import('./pl.yaml'),
  nl: () => import('./nl.yaml'),
  sv: () => import('./sv.yaml'),
  uk: () => import('./uk.yaml'),
  ar: () => import('./ar.yaml'),
  zh: () => import('./zh.yaml'),
  hi: () => import('./hi.yaml'),
  th: () => import('./th.yaml'),
  ja: () => import('./ja.yaml'),
  ko: () => import('./ko.yaml')
} satisfies Record<string, LocaleLoader>

/**
All supported locale codes.
*/
export type SupportedLocale = keyof typeof localeLoaders

/**
List of RTL locale codes.
*/
export const RTL_LOCALES = ['ar'] as const

// Loader registered for a locale code; `resolveLocale` only yields registered codes.
export function loaderFor(code: SupportedLocale): LocaleLoader {
  return localeLoaders[code]
}

/**
Resolve a raw BCP 47 tag to a supported locale code, or 'en'.
*/
export function resolveLocale(tag: string): SupportedLocale {
  const base = baseLanguage(tag)
  return Object.hasOwn(localeLoaders, base) ? (base as SupportedLocale) : 'en'
}
