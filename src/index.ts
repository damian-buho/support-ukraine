// SPDX-FileCopyrightText: 2026 Damián Búho <damian.buho@proton.me>
//
// SPDX-License-Identifier: MIT

import type { SupportUkraineBlockOptions } from './types.js'
import { detectLocale, loadLocale } from './i18n.js'
import { mountBanner } from './banner.js'

export type { Charity, CharityTag, SupportUkraineBlockOptions } from './types.js'
export { charitySchema, charitiesSchema } from './types.js'
export { detectLocale, loadLocale } from './i18n.js'
export { mergeCharities, isRTL, formatBannerText, randomItem, DEFAULT_CHARITIES } from './banner.js'
export { resolveLocale, RTL_LOCALES } from './locales/index.js'
export type { SupportedLocale } from './locales/index.js'

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
  const lang = detectLocale(options.locale)
  const messages = await loadLocale(lang)
  return mountBanner(lang, messages, options)
}
