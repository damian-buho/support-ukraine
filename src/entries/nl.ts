// SPDX-FileCopyrightText: 2026 Damián Búho <damian.buho@proton.me>
//
// SPDX-License-Identifier: MIT

import messages from '../locales/nl.yaml'
import { mountBanner } from '../banner.js'
import type { LocaleMessages, SupportUkraineBlockOptions } from '../types.js'

export type { Charity, CharityTag, SupportUkraineBlockOptions } from '../types.js'
export { charitySchema, charitiesSchema } from '../types.js'
export {
  DEFAULT_CHARITIES,
  mergeCharities,
  isRTL,
  formatBannerText,
  randomItem
} from '../banner.js'
export type { SupportedLocale } from '../locales/index.js'

const LANG = 'nl'

/**
 * Localized `supportUkraineBlock` with `nl` baked in.
 *
 * This build is self-contained — the locale messages are bundled inline, so
 * no second network request is needed. For optimal Core Web Vitals, load
 * only the locale you need:
 *
 * ```ts
 * import { supportUkraineBlock } from '@damian-buho/support-ukraine/nl'
 * await supportUkraineBlock()
 * ```
 *
 * The `locale` option is ignored in this build (the bundle is already
 * localized). Use the auto-detect build (`@damian-buho/support-ukraine`)
 * if you need runtime locale switching.
 */
export function supportUkraineBlock(
  options: SupportUkraineBlockOptions = {}
): Promise<HTMLElement> {
  return Promise.resolve(mountBanner(LANG, messages as unknown as LocaleMessages, options))
}
