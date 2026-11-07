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
  da: () => import('./da.yaml'),
  nb: () => import('./nb.yaml'),
  fi: () => import('./fi.yaml'),
  is: () => import('./is.yaml'),
  et: () => import('./et.yaml'),
  lv: () => import('./lv.yaml'),
  lt: () => import('./lt.yaml'),
  uk: () => import('./uk.yaml'),
  be: () => import('./be.yaml'),
  ka: () => import('./ka.yaml'),
  hy: () => import('./hy.yaml'),
  az: () => import('./az.yaml'),
  kk: () => import('./kk.yaml'),
  ky: () => import('./ky.yaml'),
  uz: () => import('./uz.yaml'),
  tg: () => import('./tg.yaml'),
  tk: () => import('./tk.yaml'),
  ar: () => import('./ar.yaml'),
  zh: () => import('./zh.yaml'),
  hi: () => import('./hi.yaml'),
  th: () => import('./th.yaml'),
  ja: () => import('./ja.yaml'),
  ko: () => import('./ko.yaml'),
  id: () => import('./id.yaml'),
  vi: () => import('./vi.yaml'),
  tr: () => import('./tr.yaml'),
  bn: () => import('./bn.yaml'),
  cs: () => import('./cs.yaml'),
  sk: () => import('./sk.yaml'),
  hu: () => import('./hu.yaml'),
  ro: () => import('./ro.yaml'),
  he: () => import('./he.yaml'),
  ur: () => import('./ur.yaml'),
  sl: () => import('./sl.yaml'),
  hr: () => import('./hr.yaml'),
  bs: () => import('./bs.yaml'),
  sr: () => import('./sr.yaml'),
  bg: () => import('./bg.yaml'),
  mk: () => import('./mk.yaml'),
  sq: () => import('./sq.yaml'),
  el: () => import('./el.yaml')
} satisfies Record<string, LocaleLoader>

/**
All supported locale codes.
*/
export type SupportedLocale = keyof typeof localeLoaders

export { RTL_LOCALES } from '../language.js'

// Loader registered for a locale code; `resolveLocale` only yields registered codes.
export function loaderFor(code: SupportedLocale): LocaleLoader {
  return localeLoaders[code]
}

// Base tags served by a sibling catalog: generic and Nynorsk Norwegian read Bokmål.
const LOCALE_ALIASES: Record<string, SupportedLocale> = { no: 'nb', nn: 'nb' }

/**
Resolve a raw BCP 47 tag to a supported locale code, or 'en'.
*/
export function resolveLocale(tag: string): SupportedLocale {
  const base = baseLanguage(tag)
  if (Object.hasOwn(LOCALE_ALIASES, base)) {
    return LOCALE_ALIASES[base] as SupportedLocale
  }
  return Object.hasOwn(localeLoaders, base) ? (base as SupportedLocale) : 'en'
}
