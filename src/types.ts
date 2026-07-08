// SPDX-FileCopyrightText: 2026 Damián Búho <damian.buho@proton.me>
//
// SPDX-License-Identifier: MIT

import { z } from 'zod'

/** Category tag for a charity. */
export const charityTagSchema = z.enum(['military', 'humanitarian', 'animals'])
export type CharityTag = z.infer<typeof charityTagSchema>

/** A charity foundation that can appear in the banner. */
export const charitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tagline: z.string().min(1),
  url: z.string().url(),
  tags: z.array(charityTagSchema).min(1)
})
export type Charity = z.infer<typeof charitySchema>

export const charitiesSchema = z.array(charitySchema)

/** Translated UI strings and charity taglines for a single locale. */
export interface LocaleMessages {
  /** Banner prefix, e.g. "Support Ukraine". */
  supportUkraine: string
  /** "All charities" link text. */
  allCharities: string
  /** Card donate button text, e.g. "Donate". */
  donate: string
  /** Translated taglines keyed by charity id. Missing keys fall back to EN. */
  charities: Record<string, { tagline: string }>
}

export interface SupportUkraineBlockOptions {
  /** Target mount element. If omitted the banner is prepended to document.body. */
  element?: HTMLElement
  /** Positioning mode: 'shift' pushes content down, 'overlap' floats on top. */
  mode?: 'shift' | 'overlap'
  /** Font size (default '0.875rem'). */
  fontSize?: string
  /** Category tags to filter by. If omitted all charities are shown. */
  tags?: CharityTag[]
  /** Avoid repeating charities across page loads using localStorage. */
  dontRepeat?: boolean
  /** Log a message to the dev console. */
  isInConsole?: boolean
  /**
   * Override the auto-detected locale (BCP 47 language tag).
   * If omitted the locale is detected from `navigator.language`.
   */
  locale?: string
}
