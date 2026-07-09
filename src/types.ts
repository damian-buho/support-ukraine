// SPDX-FileCopyrightText: 2026 Damián Búho <damian.buho@proton.me>
//
// SPDX-License-Identifier: MIT

/** Category tag for a charity. */
export const VALID_TAGS = ['military', 'humanitarian', 'animals'] as const
export type CharityTag = (typeof VALID_TAGS)[number]

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function assertNonEmptyString(value: unknown, field: string): void {
  assert(typeof value === 'string', `${field} must be a string`)
  assert(value.length > 0, `${field} must not be empty`)
}

function assertUrl(value: unknown, field: string): void {
  assertNonEmptyString(value, field)
  try {
    new URL(value)
  } catch {
    throw new Error(`${field} must be a valid URL`)
  }
}

function parseCharityTag(value: unknown): CharityTag {
  assert(
    VALID_TAGS.includes(value as CharityTag),
    `Invalid tag: ${String(value)}. Must be one of: ${VALID_TAGS.join(', ')}`
  )
  return value as CharityTag
}

/** A charity foundation that can appear in the banner. */
export interface Charity {
  id: string
  name: string
  tagline: string
  url: string
  tags: CharityTag[]
}

function parseCharity(value: unknown): Charity {
  assert(value !== null && typeof value === 'object', 'Charity must be an object')
  const record = value as Record<string, unknown>
  assertNonEmptyString(record.id, 'id')
  assertNonEmptyString(record.name, 'name')
  assertNonEmptyString(record.tagline, 'tagline')
  assertUrl(record.url, 'url')
  assert(Array.isArray(record.tags), 'tags must be an array')
  assert(record.tags.length > 0, 'tags must not be empty')
  return {
    id: record.id,
    name: record.name,
    tagline: record.tagline,
    url: record.url,
    tags: record.tags.map(tag => parseCharityTag(tag))
  }
}

export const charitySchema = {
  parse: parseCharity
}

export const charitiesSchema = {
  parse(value: unknown): Charity[] {
    assert(Array.isArray(value), 'Charities must be an array')
    return value.map(item => parseCharity(item))
  }
}

/** Translated UI strings and charity taglines for a single locale. */
export interface LocaleMessages {
  /** Banner prefix, e.g. "Support Ukraine". */
  supportUkraine: string
  /** "More…" link text. */
  more: string
  /** Card donate button text, e.g. "Donate". */
  donate: string
  /** Translated taglines keyed by charity id. Missing keys fall back to EN. */
  charities: Record<string, { tagline: string }>
}

export interface SupportUkraineBlockOptions {
  /** Target mount element. If omitted the banner is prepended to document.body. */
  element?: HTMLElement
  /** Positioning mode: 'shift' pushes content down, 'overlap' floats on top, 'replace' swaps a same-class placeholder. */
  mode?: 'shift' | 'overlap' | 'replace'
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
