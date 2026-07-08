// SPDX-FileCopyrightText: 2026 Damián Búho <damian.buho@proton.me>
//
// SPDX-License-Identifier: MIT

import { describe, it, before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import type { Charity, CharityTag } from '../src/types.js'
import { charitiesSchema } from '../src/types.js'
import { supportUkraineBlock, DEFAULT_CHARITIES, randomItem } from '../src/index.js'
import { detectLocale, loadLocale, mergeCharities, isRTL, formatBannerText } from '../src/i18n.js'
import { resolveLocale } from '../src/locales/index.js'

// ── DEFAULT_CHARITIES ───────────────────────────────────────────────────

describe('DEFAULT_CHARITIES', () => {
  it('is a non-empty array', () => {
    assert.ok(Array.isArray(DEFAULT_CHARITIES))
    assert.ok(DEFAULT_CHARITIES.length > 0)
  })

  it('every charity has id, name, tagline, url, and tags', () => {
    const validTags = new Set<CharityTag>(['military', 'humanitarian', 'animals'])
    for (const charity of DEFAULT_CHARITIES) {
      assert.equal(typeof charity.id, 'string', 'id must be a string')
      assert.ok(charity.id.length > 0, 'id must not be empty')
      assert.equal(typeof charity.name, 'string', 'name must be a string')
      assert.ok(charity.name.length > 0, 'name must not be empty')
      assert.equal(typeof charity.tagline, 'string', 'tagline must be a string')
      assert.ok(charity.tagline.length > 0, 'tagline must not be empty')
      assert.equal(typeof charity.url, 'string', 'url must be a string')
      assert.ok(charity.url.startsWith('http'), 'url must start with http')
      assert.ok(Array.isArray(charity.tags), 'tags must be an array')
      assert.ok(charity.tags.length > 0, 'tags must not be empty')
      for (const tag of charity.tags) {
        assert.ok(validTags.has(tag), `tag "${tag}" must be a valid CharityTag`)
      }
    }
  })

  it('has at least 5 charities', () => {
    assert.ok(DEFAULT_CHARITIES.length >= 5)
  })

  it('has unique charity ids', () => {
    const ids = DEFAULT_CHARITIES.map((c: Charity) => c.id)
    const unique = new Set(ids)
    assert.equal(ids.length, unique.size, 'charity ids must be unique')
  })

  it('has unique charity names', () => {
    const names = DEFAULT_CHARITIES.map((c: Charity) => c.name)
    const unique = new Set(names)
    assert.equal(names.length, unique.size, 'charity names must be unique')
  })

  it('has charities for each tag', () => {
    const tags = new Set<CharityTag>()
    for (const charity of DEFAULT_CHARITIES) {
      for (const tag of charity.tags) {
        tags.add(tag)
      }
    }
    assert.ok(tags.has('military'), 'must have at least one military charity')
    assert.ok(tags.has('humanitarian'), 'must have at least one humanitarian charity')
    assert.ok(tags.has('animals'), 'must have at least one animals charity')
  })
})

// ── charitiesSchema ───────────────────────────────────────────────────

describe('charitiesSchema', () => {
  it('accepts valid charity objects', () => {
    const valid = [
      {
        id: 'test',
        name: 'Test',
        tagline: 'Helping',
        url: 'https://example.com',
        tags: ['military']
      }
    ]
    assert.doesNotThrow(() => charitiesSchema.parse(valid))
  })

  it('rejects missing required fields', () => {
    const incomplete = [{ id: 'test' }]
    assert.throws(() => charitiesSchema.parse(incomplete))
  })

  it('rejects invalid url', () => {
    const bad = [{ id: 't', name: 'T', tagline: 'T', url: 'not-a-url', tags: ['military'] }]
    assert.throws(() => charitiesSchema.parse(bad))
  })

  it('rejects invalid tag', () => {
    const bad = [{ id: 't', name: 'T', tagline: 'T', url: 'https://x.com', tags: ['invalid'] }]
    assert.throws(() => charitiesSchema.parse(bad))
  })

  it('rejects empty tags array', () => {
    const bad = [{ id: 't', name: 'T', tagline: 'T', url: 'https://x.com', tags: [] }]
    assert.throws(() => charitiesSchema.parse(bad))
  })
})

// ── randomItem ──────────────────────────────────────────────────────────

describe('randomItem', () => {
  it('is a function', () => {
    assert.equal(typeof randomItem, 'function')
  })

  it('returns an item from the array', () => {
    const items = ['a', 'b', 'c']
    for (let index = 0; index < 20; index++) {
      const result = randomItem(items)
      assert.ok(items.includes(result))
    }
  })

  it('returns the single item when array has one element', () => {
    assert.equal(randomItem(['only']), 'only')
  })

  it('throws on empty array', () => {
    assert.throws(() => randomItem([]), /empty array/)
  })
})

// ── resolveLocale ───────────────────────────────────────────────────────

describe('resolveLocale', () => {
  it('returns "en" for English tags', () => {
    assert.equal(resolveLocale('en'), 'en')
    assert.equal(resolveLocale('en-US'), 'en')
    assert.equal(resolveLocale('en-GB'), 'en')
  })

  it('resolves supported locales by base tag', () => {
    assert.equal(resolveLocale('es'), 'es')
    assert.equal(resolveLocale('es-MX'), 'es')
    assert.equal(resolveLocale('fr'), 'fr')
    assert.equal(resolveLocale('fr-CA'), 'fr')
    assert.equal(resolveLocale('ar'), 'ar')
    assert.equal(resolveLocale('zh-CN'), 'zh')
    assert.equal(resolveLocale('ja'), 'ja')
    assert.equal(resolveLocale('ko'), 'ko')
  })

  it('falls back to "en" for unsupported locales', () => {
    assert.equal(resolveLocale('xx'), 'en')
    assert.equal(resolveLocale('unknown'), 'en')
  })
})

// ── detectLocale ────────────────────────────────────────────────────────

describe('detectLocale', () => {
  it('returns the preferred locale when provided', () => {
    assert.equal(detectLocale('es'), 'es')
    assert.equal(detectLocale('fr-CA'), 'fr')
  })

  it('falls back to "en" when navigator is undefined (Node)', () => {
    // Save and mock navigator
    const savedNavigator = navigator
    delete globalThis.navigator
    assert.equal(detectLocale(), 'en')
    // eslint-disable-next-line unicorn/no-global-object-property-assignment
    globalThis.navigator = savedNavigator
  })

  it('prefers navigator.languages over navigator.language', () => {
    const savedNavigator = navigator
    // eslint-disable-next-line unicorn/no-global-object-property-assignment
    globalThis.navigator = {
      language: 'en-US',
      languages: ['es-MX', 'en-US']
    } as Navigator
    assert.equal(detectLocale(), 'es')
    // eslint-disable-next-line unicorn/no-global-object-property-assignment
    globalThis.navigator = savedNavigator
  })

  it('falls back to navigator.language when navigator.languages has no match', () => {
    const savedNavigator = navigator
    // eslint-disable-next-line unicorn/no-global-object-property-assignment
    globalThis.navigator = {
      language: 'fr-CA',
      languages: ['en-US']
    } as Navigator
    assert.equal(detectLocale(), 'fr')
    // eslint-disable-next-line unicorn/no-global-object-property-assignment
    globalThis.navigator = savedNavigator
  })
})

// ── loadLocale ──────────────────────────────────────────────────────────

describe('loadLocale', () => {
  it('loads the English locale', async () => {
    const messages = await loadLocale('en')
    assert.equal(typeof messages.supportUkraine, 'string')
    assert.ok(messages.supportUkraine.length > 0)
    assert.equal(typeof messages.allCharities, 'string')
    assert.ok(messages.allCharities.length > 0)
    assert.equal(typeof messages.charities, 'object')
  })

  it('loads a non-English locale', async () => {
    const messages = await loadLocale('es')
    assert.equal(typeof messages.supportUkraine, 'string')
    assert.ok(messages.supportUkraine.length > 0)
    assert.equal(typeof messages.charities, 'object')
  })

  it('falls back to English for unknown locale', async () => {
    const messages = await loadLocale('zz')
    assert.equal(messages.supportUkraine, 'Support Ukraine')
  })
})

// ── mergeCharities ──────────────────────────────────────────────────────

describe('mergeCharities', () => {
  it('merges locale taglines over base charities', async () => {
    const messages = await loadLocale('es')
    const merged = mergeCharities(DEFAULT_CHARITIES, messages)
    assert.equal(merged.length, DEFAULT_CHARITIES.length)

    const united24 = merged.find(c => c.id === 'united24')
    assert.ok(united24)
    // Spanish tagline should differ from English
    assert.notEqual(united24.tagline, DEFAULT_CHARITIES[0]!.tagline)
  })

  it('keeps English tagline when charity id is missing from locale', async () => {
    const messages = {
      supportUkraine: 'Test',
      allCharities: 'Test',
      donate: 'Test',
      charities: {}
    }
    const merged = mergeCharities(DEFAULT_CHARITIES, messages)
    for (const [index, item] of merged.entries()) {
      assert.equal(item.tagline, DEFAULT_CHARITIES[index]!.tagline)
    }
  })
})

// ── isRTL ───────────────────────────────────────────────────────────────

describe('isRTL', () => {
  it('returns true for Arabic', () => {
    assert.equal(isRTL('ar'), true)
    assert.equal(isRTL('ar-SA'), true)
  })

  it('returns false for LTR locales', () => {
    assert.equal(isRTL('en'), false)
    assert.equal(isRTL('es'), false)
    assert.equal(isRTL('fr'), false)
    assert.equal(isRTL('zh'), false)
    assert.equal(isRTL('ja'), false)
  })
})

// ── formatBannerText ────────────────────────────────────────────────────

describe('formatBannerText', () => {
  it('formats the banner text with charity and messages', async () => {
    const messages = await loadLocale('en')
    const charity = DEFAULT_CHARITIES[0]!
    const result = formatBannerText(charity, messages)
    assert.ok(result.includes(charity.name))
    assert.ok(result.includes(charity.tagline))
    assert.ok(result.includes(messages.supportUkraine))
  })
})

// ── supportUkraineBlock ─────────────────────────────────────────────────

describe('supportUkraineBlock', () => {
  it('is a function', () => {
    assert.equal(typeof supportUkraineBlock, 'function')
  })
})

// ── dontRepeat ─────────────────────────────────────────────────────────

// Minimal DOM stub so supportUkraineBlock can run in Node
class MockElement {
  private _attrs = new Map<string, string>()
  private _children: MockElement[] = []
  className = ''
  href = ''
  textContent = ''
  style = { fontSize: '' }

  append(...items: MockElement[]) {
    this._children.push(...items)
  }

  prepend(_item: MockElement) {}

  setAttribute(name: string, value: string) {
    this._attrs.set(name, value)
  }

  getAttribute(name: string) {
    return this._attrs.get(name) ?? ''
  }

  get firstChild() {
    return this._children[0]
  }

  get lastChild() {
    return this._children.at(-1)
  }
}

function setupDom(): void {
  if (!globalThis.document) {
    Object.defineProperty(globalThis, 'document', {
      value: {
        head: { append() {} },
        body: { prepend() {} },
        createElement(): MockElement {
          return new MockElement()
        },
        querySelector() {
          // return nothing — no existing style element
        }
      },
      writable: true,
      configurable: true
    })
  }
}

const STORAGE_KEY = 'support-ukraine-seen'
const storage = { store: new Map<string, string>() }

function setupStorage(): void {
  storage.store = new Map()
  if (!globalThis.localStorage) {
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem(key: string) {
          return storage.store.get(key)
        },
        setItem(key: string, value: string) {
          storage.store.set(key, value)
        },
        clear() {
          storage.store.clear()
        }
      },
      writable: true,
      configurable: true
    })
  }
}

describe('dontRepeat', () => {
  before(() => {
    setupDom()
    setupStorage()
  })

  beforeEach(() => {
    storage.store.clear()
  })

  it('does not touch localStorage when dontRepeat is false', async () => {
    await supportUkraineBlock({ dontRepeat: false })
    assert.equal(storage.store.size, 0)
  })

  it('writes seen URL to localStorage after mounting', async () => {
    const banner = await supportUkraineBlock({
      dontRepeat: true,
      tags: ['animals']
    })
    const seen = JSON.parse(storage.store.get(STORAGE_KEY) ?? '[]') as string[]
    assert.equal(seen.length, 1)
    const link = banner.firstChild as unknown as { href: string }
    assert.equal(seen[0], link.href)
  })

  it('avoids repeating charities across calls', async () => {
    const seenUrls = new Set<string>()

    for (let index = 0; index < 3; index++) {
      const banner = await supportUkraineBlock({ tags: ['animals'], dontRepeat: true })
      const link = banner.firstChild as unknown as { href: string }
      seenUrls.add(link.href)
    }

    assert.equal(seenUrls.size, 3, 'all 3 animal charities should appear exactly once')
  })

  it('resets after all charities have been seen', async () => {
    // First cycle: all animal charities appear
    await supportUkraineBlock({ tags: ['animals'], dontRepeat: true })
    await supportUkraineBlock({ tags: ['animals'], dontRepeat: true })

    const afterFirstCycle = JSON.parse(storage.store.get(STORAGE_KEY) ?? '[]') as string[]
    assert.equal(afterFirstCycle.length, 2)

    // Third call: cycle resets, picks from full list again
    const banner = await supportUkraineBlock({ tags: ['animals'], dontRepeat: true })
    const link = banner.firstChild as unknown as { href: string }
    const animals = DEFAULT_CHARITIES.filter((c: Charity) => c.tags.includes('animals'))
    assert.ok(animals.some((c: Charity) => c.url === link.href))
  })

  it('works with tags filter', async () => {
    const military = DEFAULT_CHARITIES.filter((c: Charity) => c.tags.includes('military'))
    const seenUrls = new Set<string>()

    for (let index = 0; index < military.length; index++) {
      const banner = await supportUkraineBlock({
        tags: ['military'],
        dontRepeat: true
      })
      const link = banner.firstChild as unknown as { href: string }
      seenUrls.add(link.href)
    }

    assert.equal(seenUrls.size, military.length)
    for (const url of seenUrls) {
      assert.ok(
        military.some((c: Charity) => c.url === url),
        'only military charities shown'
      )
    }
  })

  it('treats empty tags array as no filter', async () => {
    const banner = await supportUkraineBlock({
      tags: [],
      dontRepeat: false
    })
    const link = banner.firstChild as unknown as { href: string }
    assert.ok(link.href.length > 0, 'should mount a banner with a valid charity')
  })

  it('falls back to all charities when tags match nothing', async () => {
    const banner = await supportUkraineBlock({
      tags: ['nonexistent' as CharityTag],
      dontRepeat: false
    })
    const link = banner.firstChild as unknown as { href: string }
    assert.ok(link.href.length > 0, 'should mount a banner despite no tag match')
  })
})

// ── i18n integration ────────────────────────────────────────────────────

describe('i18n integration', () => {
  before(() => {
    setupDom()
    setupStorage()
  })

  beforeEach(() => {
    storage.store.clear()
  })

  it('banner uses translated text when locale is specified', async () => {
    const banner = await supportUkraineBlock({
      locale: 'es',
      tags: ['animals'],
      dontRepeat: false
    })
    // banner → link → prefix + info
    const link = banner.firstChild as MockElement
    const info = link.lastChild as MockElement
    const text = info.textContent
    assert.ok(text.length > 0, 'banner text should not be empty')
    const animals = DEFAULT_CHARITIES.filter((c: Charity) => c.tags.includes('animals'))
    assert.ok(
      animals.some(c => text.includes(c.name)),
      'should include a charity name'
    )
  })

  it('banner uses English by default', async () => {
    const savedNavigator = navigator
    delete globalThis.navigator
    try {
      const banner = await supportUkraineBlock({
        tags: ['animals'],
        dontRepeat: false
      })
      const link = banner.firstChild as MockElement
      const prefix = link.firstChild as MockElement
      const text = prefix.textContent
      assert.ok(text.includes('Support Ukraine'), 'should contain English text')
    } finally {
      // eslint-disable-next-line unicorn/no-global-object-property-assignment
      globalThis.navigator = savedNavigator
    }
  })

  it('banner has dir="rtl" for Arabic locale', async () => {
    const banner = await supportUkraineBlock({
      locale: 'ar',
      tags: ['animals'],
      dontRepeat: false
    })
    const direction = (banner as unknown as { getAttribute: (n: string) => string }).getAttribute(
      'dir'
    )
    assert.equal(direction, 'rtl')
  })

  it('banner does not have dir="rtl" for LTR locales', async () => {
    const banner = await supportUkraineBlock({
      locale: 'en',
      tags: ['animals'],
      dontRepeat: false
    })
    const direction = (banner as unknown as { getAttribute: (n: string) => string }).getAttribute(
      'dir'
    )
    assert.notEqual(direction, 'rtl')
  })

  it('allCharities link uses translated text', async () => {
    const banner = await supportUkraineBlock({
      locale: 'es',
      tags: ['animals'],
      dontRepeat: false
    })
    const allLink = banner.lastChild as MockElement
    const allText = allLink.firstChild as MockElement
    const text = allText.textContent
    assert.ok(text.length > 0, 'allCharities text should not be empty')
    assert.notEqual(text, 'All charities', 'should be translated')
  })
})
