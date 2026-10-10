// SPDX-FileCopyrightText: 2026 Damián Búho <damian.buho@proton.me>
//
// SPDX-License-Identifier: MIT

import {
  charitiesSchema,
  type Charity,
  type LocaleMessages,
  type SupportUkraineBlockOptions
} from './types.js'
import rawCharities from './charities.yaml'
import styles from './styles.scss'

export type { Charity, CharityTag, SupportUkraineBlockOptions, LocaleMessages } from './types.js'

export const DEFAULT_CHARITIES: Charity[] = charitiesSchema.parse(rawCharities)

const CSS_PREFIX = 'support-ukraine-block'
const STORAGE_KEY = 'support-ukraine-seen'
const REFRESH_GLYPH = '\u{27F3}'
const VISUALLY_HIDDEN_CLASS = `${CSS_PREFIX}__visually-hidden`
const bannerState = { count: 0 } // Suffix for hint ids so repeated banners stay unique.

const memorySeen = new Set<string>() // Session-only seen ids, used when persistSeen is false.

// @internal — test helper resetting the session-only seen set.
export function resetMemorySeen(): void {
  memorySeen.clear()
}

function readSeen(shouldPersist: boolean): Set<string> {
  if (!shouldPersist) return new Set(memorySeen)
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

function writeSeen(seen: Set<string>, shouldPersist: boolean): void {
  if (!shouldPersist) {
    memorySeen.clear()
    for (const id of seen) memorySeen.add(id)
    return
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]))
  } catch {
    // localStorage unavailable — degrade silently
  }
}

function updateSeen(mutate: (seen: Set<string>) => void, shouldPersist: boolean): void {
  const seen = readSeen(shouldPersist)
  mutate(seen)
  writeSeen(seen, shouldPersist)
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

function pickCharity(
  candidates: Charity[],
  shouldAvoidRepeat: boolean,
  shouldPersist: boolean,
  lang: string,
  excludeId?: string,
  excludeUrl?: string
): Charity {
  let pool = excludeId ? candidates.filter(c => c.id !== excludeId) : candidates
  if (excludeUrl && pool.length > 1) {
    const withoutUrl = pool.filter(c => charityUrlFor(c, lang) !== excludeUrl)
    if (withoutUrl.length > 0) pool = withoutUrl
  }
  if (pool.length === 0) pool = candidates

  if (shouldAvoidRepeat) {
    updateSeen(seen => {
      const unseen = pool.filter(c => !seen.has(c.id))
      if (unseen.length > 0) {
        pool = unseen
      } else {
        seen.clear()
      }
    }, shouldPersist)
  }

  const charity = randomItem(pool)

  if (shouldAvoidRepeat) {
    updateSeen(seen => {
      seen.add(charity.id)
    }, shouldPersist)
  }

  return charity
}

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
 * Merge base charities with locale-specific translations.
 */
export function mergeCharities(base: readonly Charity[], locale: LocaleMessages): Charity[] {
  return base.map(charity => {
    const translated = locale.charities[charity.id]
    return translated?.tagline ? { ...charity, tagline: translated.tagline } : charity
  })
}

/**
 * Resolve the donation URL for a charity in the given banner language.
 * Falls back to English.
 */
export function charityUrlFor(charity: Charity, lang: string): string {
  const base = (lang.split('-', 1)[0] ?? '').toLowerCase()
  return charity.urls[base] ?? charity.urls.en
}

export function isRTL(lang: string): boolean {
  const base = (lang.split('-', 1)[0] ?? '').toLowerCase()
  return base === 'ar'
}

export function isDoNotTrackEnabled(): boolean {
  if (typeof navigator === 'undefined') return false
  const dnt = navigator.doNotTrack
  if (dnt === '1' || dnt === 'yes') return true
  const win = globalThis.window
  if (win) {
    const dntWin = (win as unknown as { doNotTrack?: string }).doNotTrack
    if (dntWin === '1' || dntWin === 'yes') return true
    const msDnt = (navigator as unknown as { msDoNotTrack?: string }).msDoNotTrack
    if (msDnt === '1') return true
  }
  return false
}

export function buildUtmUrl(baseUrl: string, options: SupportUkraineBlockOptions): string {
  // Default utmEnabled to true if not explicitly set to false
  if (options.utmEnabled === false) return baseUrl
  if (isDoNotTrackEnabled()) return baseUrl

  const source = options.utmSource ?? globalThis.window?.location?.hostname ?? ''
  if (!source) return baseUrl

  const medium = options.utmMedium ?? 'support-ukraine-banner'
  const campaign = options.utmCampaign ?? ''

  try {
    const url = new URL(baseUrl)
    url.searchParams.set('utm_source', source)
    url.searchParams.set('utm_medium', medium)
    if (campaign) url.searchParams.set('utm_campaign', campaign)
    return url.href
  } catch {
    return baseUrl
  }
}

export function formatBannerText(charity: Charity, messages: LocaleMessages): string {
  return `\u{1F1FA}\u{1F1E6} ${messages.supportUkraine} ${charity.name}: ${charity.tagline}`
}

/**
 * Mount the banner with already-resolved `lang` and `messages`.
 * Shared by the auto-detect build (`src/index.ts`) and the per-locale builds (`src/entries/*.ts`).
 */
export function mountBanner(
  lang: string,
  messages: LocaleMessages,
  options: SupportUkraineBlockOptions = {}
): HTMLElement & { destroy: () => void } {
  const {
    mode = 'shift',
    fontSize = '87.5%',
    charities,
    tags,
    exclude,
    dontRepeat = true,
    persistSeen = false,
    isInConsole = true,
    showRefreshButton = false,
    autoRefreshInterval = 0,
    refreshOnClick = true,
    refreshOnClickDelay = 2000,
    showRefreshAnimation = false
  } = options

  const baseCharities = charities ? charitiesSchema.parse(charities) : DEFAULT_CHARITIES
  const localizedCharities = mergeCharities(baseCharities, messages)

  let candidates =
    tags && tags.length > 0
      ? localizedCharities.filter(charity => charity.tags.some(t => tags.includes(t)))
      : localizedCharities

  if (exclude && exclude.length > 0) {
    const excluded = new Set(exclude)
    const kept = candidates.filter(charity => !excluded.has(charity.id))
    if (kept.length > 0) candidates = kept
  }

  if (candidates.length === 0) {
    candidates = localizedCharities
  }

  const charity = pickCharity(candidates, dontRepeat, persistSeen, lang)
  let currentCharity = charity
  let currentCharityUrl = charityUrlFor(charity, lang)

  const host = document.createElement('div')

  const shadow = host.attachShadow({ mode: 'open' })
  injectShadowStyles(shadow)

  const banner = document.createElement('section')
  banner.className = `${CSS_PREFIX} ${CSS_PREFIX}--${mode}`
  banner.lang = lang
  banner.setAttribute('aria-label', messages.regionLabel)

  if (isRTL(lang)) {
    banner.setAttribute('dir', 'rtl')
  }

  const link = document.createElement('a')
  link.className = `${CSS_PREFIX}__link`
  link.href = buildUtmUrl(currentCharityUrl, options)
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.style.fontSize = fontSize

  const instanceSuffix = ++bannerState.count // Unique per mount for hint ids.
  const linkNewTabId = `${CSS_PREFIX}-link-new-tab-${instanceSuffix}`
  const linkNewTabHint = document.createElement('span')
  linkNewTabHint.id = linkNewTabId
  linkNewTabHint.className = VISUALLY_HIDDEN_CLASS
  linkNewTabHint.textContent = messages.opensInNewTab
  link.setAttribute('aria-describedby', linkNewTabId)

  const flag = document.createElement('span')
  flag.className = `${CSS_PREFIX}__flag`
  flag.textContent = `\u{1F1FA}\u{1F1E6} `
  flag.setAttribute('aria-hidden', 'true') // Flag duplicates "Ukraine" in link text.

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
  moreLink.href = buildUtmUrl('https://damian-buho.github.io/support-ukraine/', options)
  moreLink.target = '_blank'
  moreLink.rel = 'noopener noreferrer'
  moreLink.style.fontSize = fontSize

  const moreNewTabId = `${CSS_PREFIX}-more-new-tab-${instanceSuffix}`
  const moreNewTabHint = document.createElement('span')
  moreNewTabHint.id = moreNewTabId
  moreNewTabHint.className = VISUALLY_HIDDEN_CLASS
  moreNewTabHint.textContent = messages.opensInNewTab
  moreLink.setAttribute('aria-describedby', moreNewTabId)

  const moreText = document.createElement('span')
  moreText.className = `${CSS_PREFIX}__more-text`
  moreText.textContent = messages.more

  const moreEllipsis = document.createElement('span')
  moreEllipsis.className = `${CSS_PREFIX}__more-ellipsis`
  moreEllipsis.textContent = '\u{2026}'

  moreLink.append(moreText, moreEllipsis)
  banner.append(moreLink)
  banner.append(linkNewTabHint, moreNewTabHint)

  function applyNext(next: Charity): void {
    currentCharity = next
    currentCharityUrl = charityUrlFor(next, lang)
    link.href = buildUtmUrl(currentCharityUrl, options)
    name.textContent = next.name
    tagline.textContent = next.tagline
    if (isInConsole) {
      console.info('[support-ukraine] banner', `${next.name}: ${next.tagline}`, currentCharityUrl)
    }
  }

  function updateCharity(): void {
    const next = pickCharity(
      candidates,
      dontRepeat,
      persistSeen,
      lang,
      currentCharity.id,
      currentCharityUrl
    )
    if (showRefreshAnimation) {
      banner.classList.add(`${CSS_PREFIX}--refreshing`)
      setTimeout(() => {
        applyNext(next)
        banner.classList.remove(`${CSS_PREFIX}--refreshing`)
      }, 200)
    } else {
      applyNext(next)
    }
  }

  let clickRefreshTimer: ReturnType<typeof setTimeout> | undefined
  function cancelClickRefresh(): void {
    if (clickRefreshTimer !== undefined) {
      clearTimeout(clickRefreshTimer)
      clickRefreshTimer = undefined
    }
    document.removeEventListener('visibilitychange', handlePageHidden)
    globalThis.window?.removeEventListener?.('blur', handleWindowBlur)
  }
  function handlePageHidden(): void {
    if (!document.hidden) return
    cancelClickRefresh()
    updateCharity()
  }
  function handleWindowBlur(): void {
    cancelClickRefresh()
    updateCharity()
  }
  function scheduleClickRefresh(): void {
    if (clickRefreshTimer !== undefined) return
    document.addEventListener('visibilitychange', handlePageHidden)
    globalThis.window?.addEventListener?.('blur', handleWindowBlur)
    clickRefreshTimer = setTimeout(() => {
      cancelClickRefresh()
      updateCharity()
    }, refreshOnClickDelay)
  }

  if (refreshOnClick) {
    link.addEventListener('click', scheduleClickRefresh)
  }

  if (showRefreshButton) {
    const refreshButton = document.createElement('button')
    refreshButton.className = `${CSS_PREFIX}__refresh`
    refreshButton.type = 'button'
    refreshButton.textContent = ''
    refreshButton.style.fontSize = fontSize
    refreshButton.setAttribute('aria-label', messages.refresh)
    refreshButton.addEventListener('click', updateCharity)
    const refreshGlyph = document.createElement('span')
    refreshGlyph.textContent = REFRESH_GLYPH
    refreshGlyph.setAttribute('aria-hidden', 'true') // Name comes from aria-label.
    refreshButton.append(refreshGlyph)
    // eslint-disable-next-line unicorn/prefer-modern-dom-apis
    banner.insertBefore(refreshButton, moreLink)
  }

  shadow.append(banner)

  const mount = options.element ?? document.body

  if (mode === 'replace') {
    const placeholder = mount.querySelector<HTMLElement>(`.${CSS_PREFIX}`)
    if (placeholder) {
      placeholder.replaceWith(host)
    } else {
      mount.prepend(host)
    }
  } else {
    mount.prepend(host)
  }

  if (isInConsole) {
    console.info(
      '[support-ukraine] banner',
      `${charity.name}: ${charity.tagline}`,
      currentCharityUrl
    )
  }

  host.dataset.supportUkraine = ''
  host.classList.add(`${CSS_PREFIX}--processed`)

  let intervalId: ReturnType<typeof setInterval> | undefined
  if (autoRefreshInterval > 0) {
    intervalId = setInterval(updateCharity, autoRefreshInterval)
  }

  const instance = host as HTMLElement & { destroy: () => void }
  instance.destroy = () => {
    cancelClickRefresh()
    if (intervalId !== undefined) {
      clearInterval(intervalId)
    }
    host.remove()
  }

  return instance
}
