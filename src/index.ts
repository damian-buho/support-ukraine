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
 * Inject a <style> element into a shadow root (idempotent).
 */
function injectShadowStyles(shadowRoot: ShadowRoot): void {
  const id = `${CSS_PREFIX}-styles`
  if (shadowRoot.querySelector(`#${id}`)) {
    return
  }

  const style = shadowRoot.ownerDocument.createElement('style')
  style.id = id
  style.textContent = styles
  shadowRoot.append(style)
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

  const host = document.createElement('div')

  const shadow = host.attachShadow({ mode: 'open' })
  injectShadowStyles(shadow)

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

  const flag = document.createElement('span')
  flag.className = `${CSS_PREFIX}__flag`
  flag.textContent = `\u{1F1FA}\u{1F1E6} `

  const prefix = document.createElement('span')
  prefix.className = `${CSS_PREFIX}__prefix`
  prefix.textContent = `${messages.supportUkraine} `

  const info = document.createElement('span')
  info.className = `${CSS_PREFIX}__info`

  const name = document.createElement('span')
  name.className = `${CSS_PREFIX}__name`
  name.textContent = charity.name

  const colon = document.createElement('span')
  colon.className = `${CSS_PREFIX}__colon`
  colon.textContent = ': '

  const tagline = document.createElement('span')
  tagline.className = `${CSS_PREFIX}__tagline`
  tagline.textContent = charity.tagline

  info.append(name, colon, tagline)

  link.append(flag, prefix, info)
  banner.append(link)

  const moreLink = document.createElement('a')
  moreLink.className = `${CSS_PREFIX}__more`
  moreLink.href = 'https://damian-buho.github.io/support-ukraine/'
  moreLink.target = '_blank'
  moreLink.rel = 'noopener noreferrer'
  moreLink.style.fontSize = fontSize

  const moreText = document.createElement('span')
  moreText.className = `${CSS_PREFIX}__more-text`
  moreText.textContent = messages.more

  const moreEllipsis = document.createElement('span')
  moreEllipsis.className = `${CSS_PREFIX}__more-ellipsis`
  moreEllipsis.textContent = '\u{2026}'

  moreLink.append(moreText, moreEllipsis)
  banner.append(moreLink)

  shadow.append(banner)

  const mount = options.element ?? document.body

  if (mode === 'replace') {
    const placeholder = mount.querySelector<HTMLElement>(`div[data-support-ukraine]`)
    if (placeholder) {
      placeholder.replaceWith(host)
    } else {
      mount.prepend(host)
    }
  } else {
    mount.prepend(host)
  }

  if (isInConsole) {
    console.info('[support-ukraine] banner', `${charity.name}: ${charity.tagline}`, charity.url)
  }

  return host
}
