// SPDX-FileCopyrightText: 2026 Damián Búho <damian.buho@proton.me>
//
// SPDX-License-Identifier: MIT

import { charitiesSchema, type Charity, type SupportUkraineBlockOptions } from './types.js'
import rawCharities from './charities.yaml'
import styles from './styles.scss'
import { detectLocale, loadLocale, mergeCharities, isRTL } from './i18n.js'

export type { Charity, CharityTag, SupportUkraineBlockOptions } from './types.js'
export { charitySchema, charitiesSchema } from './types.js'
export { detectLocale, loadLocale, mergeCharities, isRTL, formatBannerText } from './i18n.js'
export { resolveLocale, RTL_LOCALES } from './locales/index.js'
export type { SupportedLocale } from './locales/index.js'

export const DEFAULT_CHARITIES: Charity[] = charitiesSchema.parse(rawCharities)

const CSS_PREFIX = 'support-ukraine-block'
const STORAGE_KEY = 'support-ukraine-seen'

function readSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

function writeSeen(seen: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]))
  } catch {
    // localStorage unavailable — degrade silently
  }
}

/**
 * Read the seen set, apply a mutation, and write it back atomically.
 * This avoids race conditions when multiple tabs modify localStorage.
 */
function updateSeen(mutate: (seen: Set<string>) => void): void {
  const seen = readSeen()
  mutate(seen)
  writeSeen(seen)
}

/**
 * Pick a random item from an array.
 *
 * @internal
 */
export function randomItem<T>(items: T[]): T {
  if (items.length === 0) {
    throw new Error('randomItem: cannot pick from an empty array')
  }
  return items[Math.floor(Math.random() * items.length)]!
}

/**
 * Inject minimal CSS for the banner into <head> (idempotent).
 */
function injectStyles(): void {
  const id = `${CSS_PREFIX}-styles`
  if (document.querySelector(`#${id}`)) {
    return
  }

  const style = document.createElement('style')
  style.id = id
  style.textContent = styles
  document.head.append(style)
}

/**
 * Create and mount the Ukraine-support charity banner.
 *
 * The banner is placed at the top of the page. It displays a randomly
 * selected charity with the format "🇺🇦 Support Ukraine: Name: tagline" —
 * the entire block is a clickable link. Text is translated to the user's
 * detected locale (or the explicit `locale` option).
 *
 * @example
 * ```ts
 * import { supportUkraineBlock } from '@damian-buho/support-ukraine'
 *
 * // Auto-detect locale from navigator.language
 * await supportUkraineBlock()
 *
 * // Force a specific locale
 * await supportUkraineBlock({ locale: 'es' })
 * ```
 */
export async function supportUkraineBlock(
  options: SupportUkraineBlockOptions = {}
): Promise<HTMLElement> {
  const {
    mode = 'shift',
    fontSize = '0.875rem',
    tags,
    dontRepeat = true,
    isInConsole = true,
    locale: requestedLocale
  } = options

  injectStyles()

  const lang = detectLocale(requestedLocale)
  const messages = await loadLocale(lang)
  const localizedCharities = mergeCharities(DEFAULT_CHARITIES, messages)

  let candidates =
    tags && tags.length > 0
      ? localizedCharities.filter(charity => charity.tags.some(t => tags.includes(t)))
      : localizedCharities

  if (candidates.length === 0) {
    candidates = localizedCharities
  }

  if (dontRepeat) {
    updateSeen(seen => {
      const unseen = candidates.filter(c => !seen.has(c.url))
      if (unseen.length > 0) {
        candidates = unseen
      } else {
        seen.clear()
      }
    })
  }

  const charity = randomItem(candidates)

  if (dontRepeat) {
    updateSeen(seen => {
      seen.add(charity.url)
    })
  }

  const banner = document.createElement('header')
  banner.className = `${CSS_PREFIX} ${CSS_PREFIX}--${mode}`
  banner.lang = lang

  if (isRTL(lang)) {
    banner.setAttribute('dir', 'rtl')
  }

  const link = document.createElement('a')
  link.className = `${CSS_PREFIX}__link`
  link.href = charity.url
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.style.fontSize = fontSize

  const prefix = document.createElement('span')
  prefix.className = `${CSS_PREFIX}__prefix`
  prefix.textContent = `\u{1F1FA}\u{1F1E6} ${messages.supportUkraine}:`

  const info = document.createElement('span')
  info.className = `${CSS_PREFIX}__info`
  info.textContent = `${charity.name}: ${charity.tagline}`

  link.append(prefix, info)
  banner.append(link)

  const allLink = document.createElement('a')
  allLink.className = `${CSS_PREFIX}__all`
  allLink.href = 'https://damian-buho.github.io/support-ukraine/'
  allLink.target = '_blank'
  allLink.rel = 'noopener noreferrer'
  allLink.style.fontSize = fontSize

  const allText = document.createElement('span')
  allText.className = `${CSS_PREFIX}__all-text`
  allText.textContent = messages.allCharities

  const allEllipsis = document.createElement('span')
  allEllipsis.className = `${CSS_PREFIX}__all-ellipsis`
  allEllipsis.textContent = '\u{2026}'

  allLink.append(allText, allEllipsis)
  banner.append(allLink)

  const mount = options.element ?? document.body
  mount.prepend(banner)

  if (isInConsole) {
    console.info('[support-ukraine] banner', `${charity.name}: ${charity.tagline}`, charity.url)
  }

  return banner
}
