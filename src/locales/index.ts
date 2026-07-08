// SPDX-FileCopyrightText: 2026 Damián Búho <damian.buho@proton.me>
//
// SPDX-License-Identifier: MIT

import type { LocaleMessages } from '../types.js'

/** Map of BCP 47 base language → dynamic import loader. */
export const localeLoaders: Record<string, () => Promise<{ default: LocaleMessages }>> = {
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
}

/** All supported locale codes. */
export type SupportedLocale = keyof typeof localeLoaders

/** List of RTL locale codes. */
export const RTL_LOCALES = ['ar'] as const

/** Resolve a raw BCP 47 tag to a supported locale code, or 'en'. */
export function resolveLocale(tag: string): SupportedLocale {
  const base = (tag.split('-', 1)[0] ?? '').toLowerCase()
  if (Object.hasOwn(localeLoaders, base)) {
    return base as SupportedLocale
  }
  return 'en'
}
