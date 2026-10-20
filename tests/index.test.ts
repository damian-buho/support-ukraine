// SPDX-FileCopyrightText: 2026 Damián Búho <damian.buho@proton.me>
//
// SPDX-License-Identifier: MIT

import { describe, it, before, after, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import type { Charity, CharityTag } from '../src/types.js'
import { charitySchema, charitiesSchema } from '../src/types.js'
import {
  supportUkraineBlock,
  DEFAULT_CHARITIES,
  charityUrlFor,
  randomItem,
  resetMemorySeen,
  isDoNotTrackEnabled,
  buildUtmUrl
} from '../src/index.js'
import {
  detectLocale,
  loadLocale,
  mergeCharities,
  isRTL,
  formatBannerText,
  resetLocaleCache,
  preloadDefault
} from '../src/i18n.js'
import { injectShadowStyles } from '../src/banner.js'
import { localeLoaders, resolveLocale } from '../src/locales/index.js'
import styles from '../src/styles.scss'

// ── contrast helpers ────────────────────────────────────────────────────

function channelToLinear(channel: number): number {
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}
function hexLuminance(hex: string): number {
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b)
}
function contrastRatio(foreground: string, background: string): number {
  const high = Math.max(hexLuminance(foreground), hexLuminance(background))
  const low = Math.min(hexLuminance(foreground), hexLuminance(background))
  return (high + 0.05) / (low + 0.05)
}

// ── DEFAULT_CHARITIES ───────────────────────────────────────────────────

describe('DEFAULT_CHARITIES', () => {
  it('is a non-empty array', () => {
    assert.ok(Array.isArray(DEFAULT_CHARITIES))
    assert.ok(DEFAULT_CHARITIES.length > 0)
  })

  it('every charity has id, name, tagline, urls, and tags', () => {
    const validTags = new Set<CharityTag>(['military', 'humanitarian', 'animals'])
    for (const charity of DEFAULT_CHARITIES) {
      assert.equal(typeof charity.id, 'string', 'id must be a string')
      assert.ok(charity.id.length > 0, 'id must not be empty')
      assert.equal(typeof charity.name, 'string', 'name must be a string')
      assert.ok(charity.name.length > 0, 'name must not be empty')
      assert.equal(typeof charity.tagline, 'string', 'tagline must be a string')
      assert.ok(charity.tagline.length > 0, 'tagline must not be empty')
      assert.equal(typeof charity.urls.en, 'string', 'urls.en must be a string')
      assert.ok(charity.urls.en.startsWith('http'), 'urls.en must start with http')
      for (const [key, value] of Object.entries(charity.urls)) {
        assert.ok(value.startsWith('http'), `urls.${key} must start with http`)
      }
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
        urls: { en: 'https://example.com' },
        tags: ['military']
      }
    ]
    assert.doesNotThrow(() => charitiesSchema.parse(valid))
  })

  it('rejects missing required fields', () => {
    const incomplete = [{ id: 'test' }]
    assert.throws(() => charitiesSchema.parse(incomplete))
  })

  it('rejects invalid urls entry', () => {
    const bad = [
      { id: 't', name: 'T', tagline: 'T', urls: { en: 'not-a-url' }, tags: ['military'] }
    ]
    assert.throws(() => charitiesSchema.parse(bad))
  })

  it('rejects invalid tag', () => {
    const bad = [
      { id: 't', name: 'T', tagline: 'T', urls: { en: 'https://x.com' }, tags: ['invalid'] }
    ]
    assert.throws(() => charitiesSchema.parse(bad))
  })

  it('rejects empty tags array', () => {
    const bad = [{ id: 't', name: 'T', tagline: 'T', urls: { en: 'https://x.com' }, tags: [] }]
    assert.throws(() => charitiesSchema.parse(bad))
  })

  it('accepts localized urls', () => {
    const valid = [
      {
        id: 't',
        name: 'T',
        tagline: 'T',
        urls: { en: 'https://x.com/en', de: 'https://x.com/de' },
        tags: ['military']
      }
    ]
    assert.doesNotThrow(() => charitiesSchema.parse(valid))
  })

  it('rejects missing urls', () => {
    const bad = [{ id: 't', name: 'T', tagline: 'T', tags: ['military'] }]
    assert.throws(() => charitiesSchema.parse(bad), /urls must be an object/)
  })

  it('rejects urls without an english entry', () => {
    const bad = [
      { id: 't', name: 'T', tagline: 'T', urls: { uk: 'https://x.com/uk' }, tags: ['military'] }
    ]
    assert.throws(() => charitiesSchema.parse(bad), /urls must include an "en" entry/)
  })

  it('rejects invalid localized urls', () => {
    const bad = [
      {
        id: 't',
        name: 'T',
        tagline: 'T',
        urls: { en: 'not-a-url' },
        tags: ['military']
      }
    ]
    assert.throws(() => charitiesSchema.parse(bad))
  })

  it('rejects empty localized urls', () => {
    const bad = [{ id: 't', name: 'T', tagline: 'T', urls: {}, tags: ['military'] }]
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

  it('indexes the array by the random value', async () => {
    await withRandom([0.5], async () => {
      assert.equal(randomItem(['a', 'b', 'c']), 'b')
    })
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
    assert.equal(typeof messages.more, 'string')
    assert.ok(messages.more.length > 0)
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
    assert.equal(messages.supportUkraine, 'Support Ukraine with')
  })

  it('preloads the English locale', async () => {
    const messages = await preloadDefault()
    assert.equal(messages.supportUkraine, 'Support Ukraine with')
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
    const first = DEFAULT_CHARITIES[0]
    assert.ok(first)
    // Spanish tagline should differ from English
    assert.notEqual(united24.tagline, first.tagline)
  })

  it('keeps English tagline when charity id is missing from locale', async () => {
    const messages = {
      supportUkraine: 'Test',
      regionLabel: 'Test banner',
      more: 'Test',
      donate: 'Test',
      refresh: 'Test',
      opensInNewTab: 'Test',
      charities: {}
    }
    const merged = mergeCharities(DEFAULT_CHARITIES, messages)
    for (const [index, item] of merged.entries()) {
      const expected = DEFAULT_CHARITIES[index]
      assert.ok(expected)
      assert.equal(item.tagline, expected.tagline)
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
    const charity = DEFAULT_CHARITIES[0]
    assert.ok(charity)
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

// ── charityUrlFor ─────────────────────────────────────────────────────────

describe('charityUrlFor', () => {
  before(() => {
    setupDom()
    setupStorage()
  })

  beforeEach(() => {
    storage.store.clear()
    head.children.length = 0
    body.children.length = 0
  })

  afterEach(() => {
    body.children.length = 0
  })

  it('falls back to english when the banner language has no variant', () => {
    const charity = DEFAULT_CHARITIES.find(c => c.id === 'cats-of-kyiv')
    assert.ok(charity)
    assert.equal(charityUrlFor(charity, 'de'), 'https://cats.kiev.ua')
  })

  it('resolves the banner language variant', () => {
    const charity = DEFAULT_CHARITIES.find(c => c.id === 'hospitallers')
    assert.ok(charity)
    assert.equal(charityUrlFor(charity, 'de'), 'https://www.hospitallers.org.uk/de')
    assert.equal(charityUrlFor(charity, 'de-AT'), 'https://www.hospitallers.org.uk/de')
    assert.equal(charityUrlFor(charity, 'it'), 'https://www.hospitallers.org.uk/it')
    assert.equal(charityUrlFor(charity, 'es'), 'https://www.hospitallers.org.uk/es')
    assert.equal(charityUrlFor(charity, 'fr'), 'https://www.hospitallers.org.uk/fr')
    assert.equal(charityUrlFor(charity, 'nl'), 'https://www.hospitallers.org.uk/nl')
    assert.equal(charityUrlFor(charity, 'pl'), 'https://www.hospitallers.org.uk/pl')
    assert.equal(charityUrlFor(charity, 'sv'), 'https://www.hospitallers.org.uk/sv')
    assert.equal(charityUrlFor(charity, 'cs'), 'https://www.hospitallers.org.uk/cs')
  })

  it('resolves life-robots multi-language variants', () => {
    const charity = DEFAULT_CHARITIES.find(c => c.id === 'life-robots-ukraine')
    assert.ok(charity)
    assert.equal(charityUrlFor(charity, 'ja'), 'https://liferobots.com.ua/ja')
    assert.equal(charityUrlFor(charity, 'ko'), 'https://liferobots.com.ua/ko')
    assert.equal(charityUrlFor(charity, 'pl'), 'https://liferobots.com.ua/pl')
    assert.equal(charityUrlFor(charity, 'uk'), 'https://liferobots.com.ua/')
    assert.equal(charityUrlFor(charity, 'zh'), 'https://liferobots.com.ua/en')
  })

  it('resolves the Dzyga’s Paw localized variants', () => {
    const charity = DEFAULT_CHARITIES.find(c => c.id === 'dzygaspaw')
    assert.ok(charity)
    assert.equal(charityUrlFor(charity, 'en'), 'https://dzygaspaw.com')
    assert.equal(charityUrlFor(charity, 'de'), 'https://dzygaspaw.com/de')
    assert.equal(charityUrlFor(charity, 'uk'), 'https://dzygaspaw.com/uk')
    assert.equal(charityUrlFor(charity, 'es'), 'https://dzygaspaw.com')
  })

  it('falls back to english when the language variant is missing', () => {
    const charity = DEFAULT_CHARITIES.find(c => c.id === 'hospitallers')
    assert.ok(charity)
    assert.equal(charityUrlFor(charity, 'uk'), 'https://www.hospitallers.org.uk')
    const noVariant: Charity = {
      id: 'x',
      name: 'X',
      tagline: 'X',
      urls: { en: 'https://x.com/en', uk: 'https://x.com/uk' },
      tags: ['military']
    }
    assert.equal(charityUrlFor(noVariant, 'uk'), 'https://x.com/uk')
    assert.equal(charityUrlFor(noVariant, 'es'), 'https://x.com/en')
  })

  it('links the banner to the localized variant', async () => {
    const charity = DEFAULT_CHARITIES.find(c => c.id === 'come-back-alive')
    assert.ok(charity?.urls, 'fixture needs localized urls')
    const host = await supportUkraineBlock({
      charities: [charity],
      locale: 'en',
      dontRepeat: false
    })
    const banner = bannerOf(host)
    const link = banner.firstChild as unknown as { href: string }
    assert.ok(link.href.startsWith('https://savelife.in.ua/en/'), `unexpected href ${link.href}`)
  })
})

// ── exclude ─────────────────────────────────────────────────────────────

function bannerName(host: HTMLElement): string {
  const banner = bannerOf(host)
  const link = banner.firstChild as MockElement
  const info = link.lastChild as MockElement
  const name = info.children.find(child => child.className === 'support-ukraine-block__name')
  assert.ok(name, 'banner names its charity')
  return name.textContent
}

describe('exclude', () => {
  before(() => {
    setupDom()
    setupStorage()
  })

  beforeEach(() => {
    storage.store.clear()
    head.children.length = 0
    body.children.length = 0
  })

  afterEach(() => {
    body.children.length = 0
  })

  it('never shows an excluded charity id', async () => {
    const excluded = DEFAULT_CHARITIES[0]
    assert.ok(excluded)
    await withRandom([0, 0, 0, 0, 0], async () => {
      for (let index = 0; index < 5; index++) {
        const host = await supportUkraineBlock({ exclude: [excluded.id], dontRepeat: false })
        assert.notEqual(bannerName(host), excluded.name)
      }
    })
  })

  it('combines with the tags filter', async () => {
    const excluded = DEFAULT_CHARITIES.find(c => c.tags.includes('military'))
    assert.ok(excluded)
    const host = await supportUkraineBlock({
      exclude: [excluded.id],
      tags: ['military'],
      dontRepeat: false
    })
    assert.notEqual(bannerName(host), excluded.name)
  })

  it('ignores unknown ids', async () => {
    const host = await supportUkraineBlock({ exclude: ['no-such-charity'], dontRepeat: false })
    assert.ok(bannerName(host).length > 0)
  })

  it('falls back to the full list when every candidate is excluded', async () => {
    const all = DEFAULT_CHARITIES.map(c => c.id)
    const host = await supportUkraineBlock({ exclude: all, dontRepeat: false })
    assert.ok(bannerName(host).length > 0)
  })

  it('keeps the tag filter when every tagged charity is excluded', async () => {
    const military = DEFAULT_CHARITIES.filter(c => c.tags.includes('military'))
    await withRandom([0], async () => {
      const host = await supportUkraineBlock({
        exclude: military.map(c => c.id),
        tags: ['military'],
        dontRepeat: false
      })
      assert.ok(
        military.some(c => c.name === bannerName(host)),
        'an exclusion that empties the list is ignored'
      )
    })
  })
})

// ── dontRepeat ─────────────────────────────────────────────────────────

// Minimal DOM stub so supportUkraineBlock can run in Node
class MockElement {
  private _attrs = new Map<string, string>()
  private _children: MockElement[] = []
  private _textContent = ''
  private _shadowRoot: MockShadowRoot | undefined
  private _listeners = new Map<string, Array<(...arguments_: unknown[]) => void>>()
  className = ''
  tagName = ''
  id = ''
  href = ''
  lang = ''
  target = ''
  rel = ''
  type = ''
  shadowMode = ''
  style = { fontSize: '' }
  dataset: Record<string, string>
  classList = {
    add: (token: string) => {
      if (!this.className.includes(token)) {
        this.className = this.className ? `${this.className} ${token}` : token
      }
    },
    contains: (token: string) => this.className.includes(token),
    remove: (token: string) => {
      this.className = this.className
        .split(/\s+/)
        .filter(c => c !== token)
        .join(' ')
    }
  }

  constructor() {
    const attributes = this._attrs
    this.dataset = new Proxy({} as Record<string, string>, {
      get(_target, property: string) {
        return attributes.get(`data-${property.replaceAll(/([A-Z])/g, '-$1').toLowerCase()}`) ?? ''
      },
      set(_target, property: string, value: string) {
        attributes.set(`data-${property.replaceAll(/([A-Z])/g, '-$1').toLowerCase()}`, value)
        return true
      }
    })
  }

  get textContent(): string {
    return this._children.length === 0
      ? this._textContent
      : this._children.map(child => child.textContent).join('')
  }

  set textContent(value: string) {
    this._textContent = value
  }

  append(...items: MockElement[]) {
    this._children.push(...items)
  }

  insertBefore(newChild: MockElement, reference: MockElement) {
    const index = this._children.indexOf(reference)
    if (index === -1) {
      this._children.push(newChild)
    } else {
      this._children.splice(index, 0, newChild)
    }
  }

  addEventListener(event: string, handler: (...arguments_: unknown[]) => void) {
    const list = this._listeners.get(event) ?? []
    list.push(handler)
    this._listeners.set(event, list)
  }

  click() {
    const handlers = this._listeners.get('click') ?? []
    for (const handler of handlers) {
      handler()
    }
  }

  prepend(_item: MockElement) {}

  setAttribute(name: string, value: string) {
    this._attrs.set(name, value)
  }

  getAttribute(name: string) {
    return this._attrs.get(name) ?? ''
  }

  replaceWith(other: MockElement) {
    const parent = body as unknown as { _children: MockElement[] }
    const index = parent._children.indexOf(this)
    if (index !== -1) {
      parent._children[index] = other
    }
  }

  remove() {
    const parent = body as unknown as { _children: MockElement[] }
    const index = parent._children.indexOf(this)
    if (index !== -1) {
      parent._children.splice(index, 1)
    }
  }

  querySelector(selector: string) {
    // data-support-ukraine attribute selector for replace mode
    const attributeMatch = selector.includes('[data-support-ukraine]')
    if (attributeMatch) {
      return this._children.find(child => child._attrs.has('data-support-ukraine')) ?? undefined
    }
    const classMatch = selector.match(/^\.([\w-]+)$/)
    if (!classMatch) return
    const className = classMatch[1]
    return this._children.find(child => child.className === className) ?? undefined
  }

  attachShadow(options: { mode: string }): MockShadowRoot {
    this.shadowMode = options.mode
    this._shadowRoot = new MockShadowRoot(this)
    return this._shadowRoot
  }

  get shadowRoot(): MockShadowRoot | undefined {
    return this._shadowRoot
  }

  get firstChild() {
    return this._children[0]
  }

  get lastChild() {
    return this._children.at(-1)
  }

  get children() {
    return this._children
  }
}

const head = new MockElement()

class MockBody {
  private _children: MockElement[] = []

  prepend(item: MockElement) {
    this._children.unshift(item)
  }

  replaceChild(newChild: MockElement, oldChild: MockElement) {
    const index = this._children.indexOf(oldChild)
    if (index !== -1) {
      this._children[index] = newChild
    }
    return oldChild
  }

  querySelector(selector: string) {
    const idMatch = selector.match(/^#(.+)$/)
    if (idMatch) {
      return head.children.find(child => child.id === idMatch[1]) ?? undefined
    }
    const attributeMatch = selector.includes('[data-support-ukraine]')
    if (attributeMatch) {
      return (
        this._children.find(child =>
          (child as unknown as { _attrs: Map<string, string> })._attrs.has('data-support-ukraine')
        ) ?? undefined
      )
    }
    const classMatch = selector.match(/^(\w*)\.([\w-]+(?:\.[\w-]+)*)$/)
    if (!classMatch) return
    const [, tag, classChain] = classMatch
    const classes = classChain.split('.')
    return this._children.find(
      child =>
        (!tag || child.tagName === tag.toUpperCase()) &&
        classes.every(c => child.className.includes(c))
    )
  }

  get children() {
    return this._children
  }

  get firstElementChild() {
    return this._children[0]
  }
}

class MockShadowRoot {
  private _children: MockElement[] = []
  private _host: MockElement

  constructor(host: MockElement) {
    this._host = host
  }

  get host(): MockElement {
    return this._host
  }

  get ownerDocument(): { createElement: (tag: string) => MockElement } {
    return {
      createElement(tag: string) {
        const element = new MockElement()
        element.tagName = tag.toUpperCase()
        return element
      }
    }
  }

  append(...items: MockElement[]) {
    this._children.push(...items)
  }

  querySelector(selector: string) {
    const idMatch = selector.match(/^#(.+)$/)
    if (idMatch) {
      return this._children.find(child => child.id === idMatch[1]) ?? undefined
    }
    return
  }

  get children(): MockElement[] {
    return this._children
  }

  get firstElementChild(): MockElement | undefined {
    return this._children[0]
  }

  /**
  Find the <section> banner element inside the shadow root.
  */
  get banner(): MockElement | undefined {
    return this._children.find(child => child.tagName === 'SECTION')
  }
}

function shadowOf(host: HTMLElement): MockShadowRoot {
  const root = (host as unknown as MockElement).shadowRoot
  assert.ok(root, 'banner host mounts a shadow root')
  return root
}

function bannerOf(host: HTMLElement): MockElement {
  const banner = shadowOf(host).banner
  assert.ok(banner, 'shadow root holds the banner section')
  return banner
}

function refreshButtonOf(host: HTMLElement): MockElement {
  const banner = bannerOf(host)
  const button = banner.children.find(child => child.className === 'support-ukraine-block__refresh')
  assert.ok(button, 'refresh button found')
  return button
}

// Runs the body with a scripted Math.random so the picked charity is deterministic.
async function withRandom<T>(values: number[], run: () => Promise<T> | T): Promise<T> {
  const original = Math.random
  let index = 0
  Math.random = () => values[Math.min(index++, values.length - 1)] ?? 0
  try {
    return await run()
  } finally {
    Math.random = original
  }
}

// Swaps a browser global for the duration of the callback and restores it afterwards.
async function withGlobal<T>(
  name: 'window' | 'navigator',
  value: unknown,
  run: () => Promise<T> | T
): Promise<T> {
  const target = globalThis as unknown as Record<string, unknown>
  const saved = target[name]
  target[name] = value
  try {
    return await run()
  } finally {
    target[name] = saved
  }
}

// ── rotation fixtures ────────────────────────────────────────────────────

const rotationCharities: Charity[] = [
  {
    id: 'rot-a',
    name: 'Rot A',
    tagline: 'Tagline A',
    urls: { en: 'https://a.example.org' },
    tags: ['humanitarian']
  },
  {
    id: 'rot-b',
    name: 'Rot B',
    tagline: 'Tagline B',
    urls: { en: 'https://b.example.org' },
    tags: ['humanitarian']
  },
  {
    id: 'rot-c',
    name: 'Rot C',
    tagline: 'Tagline C',
    urls: { en: 'https://c.example.org' },
    tags: ['humanitarian']
  }
]

const sharedUrlCharities: Charity[] = [
  {
    id: 'shared-a',
    name: 'Shared A',
    tagline: 'Tagline A',
    urls: { en: 'https://shared.example.org' },
    tags: ['humanitarian']
  },
  {
    id: 'shared-b',
    name: 'Shared B',
    tagline: 'Tagline B',
    urls: { en: 'https://shared.example.org' },
    tags: ['humanitarian']
  },
  {
    id: 'shared-c',
    name: 'Shared C',
    tagline: 'Tagline C',
    urls: { en: 'https://shared.example.org' },
    tags: ['humanitarian']
  }
]

const mixedUrlCharities: Charity[] = [
  {
    id: 'mix-a',
    name: 'Mix A',
    tagline: 'Tagline A',
    urls: { en: 'https://mix.example.org' },
    tags: ['humanitarian']
  },
  {
    id: 'mix-b',
    name: 'Mix B',
    tagline: 'Tagline B',
    urls: { en: 'https://mix.example.org' },
    tags: ['humanitarian']
  },
  {
    id: 'mix-c',
    name: 'Mix C',
    tagline: 'Tagline C',
    urls: { en: 'https://other.example.org' },
    tags: ['humanitarian']
  }
]

const body = new MockBody()

type FocusHandler = (...arguments_: unknown[]) => void

const documentListeners = new Map<string, FocusHandler[]>()
const windowListeners = new Map<string, FocusHandler[]>()

function addListenerTo(
  store: Map<string, FocusHandler[]>,
  event: string,
  handler: FocusHandler
): void {
  const list = store.get(event) ?? []
  list.push(handler)
  store.set(event, list)
}

function removeListenerFrom(
  store: Map<string, FocusHandler[]>,
  event: string,
  handler: FocusHandler
): void {
  store.set(
    event,
    (store.get(event) ?? []).filter(item => item !== handler)
  )
}

function fireDocumentEvent(): void {
  const handlers = documentListeners.get('visibilitychange') ?? []
  for (const handler of handlers) handler()
}

function fireWindowEvent(): void {
  const handlers = windowListeners.get('blur') ?? []
  for (const handler of handlers) handler()
}

function setDocumentHidden(isHidden: boolean): void {
  ;(globalThis.document as unknown as { hidden: boolean }).hidden = isHidden
}

function setupWindow(): void {
  windowListeners.clear()
  // eslint-disable-next-line unicorn/no-global-object-property-assignment
  globalThis.window = {
    location: { hostname: 'example.com' },
    addEventListener(event: string, handler: FocusHandler) {
      addListenerTo(windowListeners, event, handler)
    },
    removeEventListener(event: string, handler: FocusHandler) {
      removeListenerFrom(windowListeners, event, handler)
    }
  }
}

function setupDom(): void {
  if (!globalThis.document) {
    Object.defineProperty(globalThis, 'document', {
      value: {
        head,
        body,
        hidden: false,
        addEventListener(event: string, handler: FocusHandler) {
          addListenerTo(documentListeners, event, handler)
        },
        removeEventListener(event: string, handler: FocusHandler) {
          removeListenerFrom(documentListeners, event, handler)
        },
        createElement(tag: string): MockElement {
          const element = new MockElement()
          element.tagName = tag.toUpperCase()
          return element
        },
        querySelector(selector: string) {
          const idMatch = selector.match(/^#(.+)$/)
          if (idMatch) {
            return head.children.find(child => child.id === idMatch[1]) ?? undefined
          }
          const attributeMatch = selector.match(/^\[([^\]]+)\]$/)
          if (attributeMatch && attributeMatch[1] === 'data-support-ukraine') {
            return body.children.find(child => child.dataset.supportUkraine !== '') ?? undefined
          }
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
    resetMemorySeen()
    head.children.length = 0
  })

  it('does not touch localStorage when dontRepeat is false', async () => {
    await supportUkraineBlock({ dontRepeat: false })
    assert.equal(storage.store.size, 0)
  })

  it('does not touch localStorage by default', async () => {
    await supportUkraineBlock({ dontRepeat: true, tags: ['animals'] })
    assert.equal(storage.store.size, 0)
  })

  it('avoids repeats within the session without localStorage', async () => {
    const names = new Set<string>()
    for (let index = 0; index < 3; index++) {
      const host = await supportUkraineBlock({ tags: ['animals'], dontRepeat: true })
      names.add(bannerName(host))
    }
    assert.equal(names.size, 3, 'all 3 animal charities should appear exactly once')
    assert.equal(storage.store.size, 0, 'session dedup must not write to localStorage')
  })

  it('writes seen id to localStorage after mounting', async () => {
    const host = await supportUkraineBlock({
      dontRepeat: true,
      persistSeen: true,
      tags: ['animals']
    })
    const seen = JSON.parse(storage.store.get(STORAGE_KEY) ?? '[]') as string[]
    assert.equal(seen.length, 1)
    const animals = DEFAULT_CHARITIES.filter(c => c.tags.includes('animals'))
    assert.ok(animals.some(c => c.id === seen[0]))
    const banner = bannerOf(host)
    const link = banner.firstChild as unknown as { href: string }
    assert.ok(link.href.length > 0)
  })

  it('avoids repeating charities across calls', async () => {
    const seenIds = new Set<string>()

    for (let index = 0; index < 3; index++) {
      const host = await supportUkraineBlock({
        tags: ['animals'],
        dontRepeat: true,
        persistSeen: true
      })
      void host
      const seen = JSON.parse(storage.store.get(STORAGE_KEY) ?? '[]') as string[]
      for (const id of seen) seenIds.add(id)
    }

    assert.equal(seenIds.size, 3, 'all 3 animal charities should appear exactly once')
  })

  it('resets after all charities have been seen', async () => {
    // First cycle: all animal charities appear
    await supportUkraineBlock({ tags: ['animals'], dontRepeat: true, persistSeen: true })
    await supportUkraineBlock({ tags: ['animals'], dontRepeat: true, persistSeen: true })

    const afterFirstCycle = JSON.parse(storage.store.get(STORAGE_KEY) ?? '[]') as string[]
    assert.equal(afterFirstCycle.length, 2)

    // Third call: cycle resets, picks from full list again
    const host = await supportUkraineBlock({
      tags: ['animals'],
      dontRepeat: true,
      persistSeen: true
    })
    const banner = bannerOf(host)
    const link = banner.firstChild as unknown as { href: string }
    const animals = DEFAULT_CHARITIES.filter((c: Charity) => c.tags.includes('animals'))
    const seenLink = link.href
    assert.ok(animals.some(c => seenLink.includes(new URL(c.urls.en).hostname)))
  })

  it('works with tags filter', async () => {
    const military = DEFAULT_CHARITIES.filter((c: Charity) => c.tags.includes('military'))
    const seenIds = new Set<string>()

    for (let index = 0; index < military.length; index++) {
      await supportUkraineBlock({
        tags: ['military'],
        dontRepeat: true,
        persistSeen: true
      })
      const seen = JSON.parse(storage.store.get(STORAGE_KEY) ?? '[]') as string[]
      for (const id of seen) seenIds.add(id)
    }

    assert.equal(seenIds.size, military.length)
    for (const id of seenIds) {
      assert.ok(
        military.some((c: Charity) => c.id === id),
        'only military charities shown'
      )
    }
  })

  it('treats empty tags array as no filter', async () => {
    const host = await supportUkraineBlock({
      tags: [],
      dontRepeat: false
    })
    const banner = bannerOf(host)
    const link = banner.firstChild as unknown as { href: string }
    assert.ok(link.href.length > 0, 'should mount a banner with a valid charity')
  })

  it('falls back to all charities when tags match nothing', async () => {
    const host = await supportUkraineBlock({
      tags: ['nonexistent' as CharityTag],
      dontRepeat: false
    })
    const banner = bannerOf(host)
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
    head.children.length = 0
  })

  it('banner uses translated text when locale is specified', async () => {
    const host = await supportUkraineBlock({
      locale: 'es',
      tags: ['animals'],
      dontRepeat: false
    })
    const banner = bannerOf(host)
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
      const host = await supportUkraineBlock({
        tags: ['animals'],
        dontRepeat: false
      })
      const banner = bannerOf(host)
      const link = banner.firstChild as MockElement
      const prefix = link.querySelector('.support-ukraine-block__prefix') as MockElement
      const text = prefix.textContent
      assert.ok(text.includes('Support Ukraine with'), 'should contain English text')
    } finally {
      // eslint-disable-next-line unicorn/no-global-object-property-assignment
      globalThis.navigator = savedNavigator
    }
  })

  it('banner has dir="rtl" for Arabic locale', async () => {
    const host = await supportUkraineBlock({
      locale: 'ar',
      tags: ['animals'],
      dontRepeat: false
    })
    const banner = bannerOf(host)
    const direction = (banner as unknown as { getAttribute: (n: string) => string }).getAttribute(
      'dir'
    )
    assert.equal(direction, 'rtl')
  })

  it('banner does not have dir="rtl" for LTR locales', async () => {
    const host = await supportUkraineBlock({
      locale: 'en',
      tags: ['animals'],
      dontRepeat: false
    })
    const banner = bannerOf(host)
    const direction = (banner as unknown as { getAttribute: (n: string) => string }).getAttribute(
      'dir'
    )
    assert.notEqual(direction, 'rtl')
  })

  it('more link uses translated text', async () => {
    const host = await supportUkraineBlock({
      locale: 'es',
      tags: ['animals'],
      dontRepeat: false
    })
    const banner = bannerOf(host)
    const moreLink = banner.children.find(
      child => child.className === 'support-ukraine-block__more'
    )
    assert.ok(moreLink, 'more link found')
    const moreText = moreLink.firstChild as MockElement
    const text = moreText.textContent
    assert.ok(text.length > 0, 'more text should not be empty')
    assert.notEqual(text, 'more…', 'should be translated')
  })
})

// ── custom charities ───────────────────────────────────────────────────

describe('custom charities', () => {
  before(() => {
    setupDom()
    setupStorage()
  })

  beforeEach(() => {
    storage.store.clear()
    head.children.length = 0
    body.children.length = 0
  })

  it('uses custom charities instead of defaults', async () => {
    const customCharities: Charity[] = [
      {
        id: 'custom-1',
        name: 'Custom Charity',
        tagline: 'A test charity',
        urls: { en: 'https://example.com/donate' },
        tags: ['humanitarian']
      }
    ]
    const host = await supportUkraineBlock({
      charities: customCharities,
      dontRepeat: false
    })
    const banner = bannerOf(host)
    const link = banner.firstChild as MockElement
    assert.equal(link.href, 'https://example.com/donate')
    const text = link.textContent
    assert.ok(text.includes('Custom Charity'))
    assert.ok(text.includes('A test charity'))
  })

  it('never shows a default charity when custom list is provided', async () => {
    const customCharities: Charity[] = [
      {
        id: 'only-custom',
        name: 'Sole Charity',
        tagline: 'The one and only',
        urls: { en: 'https://custom.example.org' },
        tags: ['humanitarian']
      }
    ]
    for (let index = 0; index < 10; index++) {
      const host = await supportUkraineBlock({
        charities: customCharities,
        dontRepeat: false
      })
      const banner = bannerOf(host)
      const link = banner.firstChild as MockElement
      assert.equal(
        link.href,
        'https://custom.example.org',
        `iteration ${index}: banner must use custom charity, not defaults`
      )
    }
  })

  it('filters custom charities by tags', async () => {
    const customCharities: Charity[] = [
      {
        id: 'c-mil',
        name: 'Military One',
        tagline: 'Defense',
        urls: { en: 'https://military.example.com' },
        tags: ['military']
      },
      {
        id: 'c-hum',
        name: 'Humanitarian One',
        tagline: 'Aid',
        urls: { en: 'https://aid.example.com' },
        tags: ['humanitarian']
      }
    ]
    const host = await supportUkraineBlock({
      charities: customCharities,
      tags: ['military'],
      dontRepeat: false
    })
    const banner = bannerOf(host)
    const link = banner.firstChild as MockElement
    assert.equal(link.href, 'https://military.example.com')
  })

  it('merges locale taglines into custom charities', async () => {
    const customCharities: Charity[] = [
      {
        id: 'united24',
        name: 'Custom United24',
        tagline: 'English fallback',
        urls: { en: 'https://custom.example.org' },
        tags: ['humanitarian']
      }
    ]
    const host = await supportUkraineBlock({
      charities: customCharities,
      locale: 'es',
      dontRepeat: false
    })
    const banner = bannerOf(host)
    const link = banner.firstChild as MockElement
    const text = link.textContent
    assert.ok(text.includes('Custom United24'), 'should show custom charity name')
    assert.ok(
      !text.includes('English fallback'),
      'should use translated tagline, not English fallback'
    )
  })

  it('rejects legacy charities without a urls map', async () => {
    const legacy = [
      {
        id: 'legacy',
        name: 'Legacy',
        tagline: 'Old shape',
        url: 'https://legacy.example.org',
        tags: ['humanitarian']
      }
    ]
    await assert.rejects(
      supportUkraineBlock({ charities: legacy as unknown as Charity[], dontRepeat: false }),
      /urls must be an object/
    )
  })
})

// ── element option ─────────────────────────────────────────────────────

describe('element option', () => {
  before(() => {
    setupDom()
    setupStorage()
  })

  beforeEach(() => {
    storage.store.clear()
    head.children.length = 0
    body.children.length = 0
  })

  it('prepends banner to a custom element instead of document.body', async () => {
    const customMount = new MockElement()
    customMount.tagName = 'DIV'
    const children: MockElement[] = customMount.children
    customMount.prepend = (item: MockElement) => {
      children.unshift(item)
    }

    const host = await supportUkraineBlock({
      element: customMount,
      dontRepeat: false
    })

    assert.equal(body.children.length, 0, 'document.body should remain empty')
    assert.equal(customMount.children.length, 1, 'custom element should have one child')
    assert.equal(customMount.firstChild, host, 'banner should be prepended to custom element')
  })

  it('prepends to document.body when element is omitted', async () => {
    const host = await supportUkraineBlock({ dontRepeat: false })
    assert.equal(body.children.length, 1)
    assert.equal(body.firstElementChild, host)
  })
})

// ── replace mode ───────────────────────────────────────────────────────

describe('replace mode', () => {
  before(() => {
    setupDom()
    setupStorage()
  })

  beforeEach(() => {
    storage.store.clear()
    head.children.length = 0
    body.children.length = 0
  })

  it('replaces the placeholder when found', async () => {
    const placeholder = new MockElement()
    placeholder.tagName = 'HEADER'
    placeholder.className = 'support-ukraine-block'
    body.children.push(placeholder)

    const host = await supportUkraineBlock({ mode: 'replace', dontRepeat: false })
    assert.equal(body.children.length, 1)
    assert.equal(body.firstElementChild, host)
    assert.ok(
      host.className.includes('support-ukraine-block--processed'),
      'host has processed class'
    )
  })

  it('falls back to prepend when no placeholder exists', async () => {
    const host = await supportUkraineBlock({ mode: 'replace', dontRepeat: false })
    assert.equal(body.children.length, 1)
    assert.equal(body.firstElementChild, host)
  })

  it('only replaces the first matching placeholder', async () => {
    const p1 = new MockElement()
    p1.tagName = 'HEADER'
    p1.className = 'support-ukraine-block'
    const p2 = new MockElement()
    p2.tagName = 'HEADER'
    p2.className = 'support-ukraine-block'
    body.children.push(p1, p2)

    await supportUkraineBlock({ mode: 'replace', dontRepeat: false })
    assert.equal(body.children.length, 2)
    assert.notEqual(body.firstElementChild, p1, 'first placeholder was replaced')
    assert.ok(body.children.includes(p2), 'second placeholder untouched')
  })

  it('replaces any same-class element, not only <header>', async () => {
    const div = new MockElement()
    div.tagName = 'DIV'
    div.className = 'support-ukraine-block'
    body.children.push(div)

    await supportUkraineBlock({ mode: 'replace', dontRepeat: false })
    assert.equal(body.children.length, 1)
    assert.notEqual(body.firstElementChild, div, 'div placeholder was replaced')
  })

  it('prepends instead of replacing in shift mode', async () => {
    const placeholder = new MockElement()
    placeholder.tagName = 'HEADER'
    placeholder.className = 'support-ukraine-block'
    body.children.push(placeholder)

    const host = await supportUkraineBlock({ dontRepeat: false })
    assert.equal(body.children.length, 2, 'the placeholder stays and the banner is prepended')
    assert.equal(body.firstElementChild, host)
  })
})

// ── accessibility (landmarks) ────────────────────────────────────────────

describe('accessibility', () => {
  before(() => {
    setupDom()
    setupStorage()
  })

  beforeEach(() => {
    storage.store.clear()
    head.children.length = 0
    body.children.length = 0
  })

  it('renders a labeled section landmark, not a second banner', async () => {
    const host = await supportUkraineBlock({ dontRepeat: false, locale: 'en' })
    const banner = bannerOf(host)
    assert.equal(banner.tagName, 'SECTION')
    const label = (banner as unknown as { getAttribute: (n: string) => string }).getAttribute(
      'aria-label'
    )
    assert.equal(label, 'Support Ukraine banner')
  })

  it('localizes the landmark name with the banner language', async () => {
    const host = await supportUkraineBlock({ dontRepeat: false, locale: 'es' })
    const banner = bannerOf(host)
    const label = (banner as unknown as { getAttribute: (n: string) => string }).getAttribute(
      'aria-label'
    )
    assert.equal(label, 'Banner de apoyo a Ucrania')
  })

  it('uses unique hint ids when two banners share a page', async () => {
    const first = await supportUkraineBlock({ dontRepeat: false })
    const second = await supportUkraineBlock({ dontRepeat: false })
    const ids = [first, second].flatMap(host =>
      bannerOf(host)
        .children.filter(child => child.tagName === 'A')
        .map(link =>
          (link as unknown as { getAttribute: (n: string) => string }).getAttribute(
            'aria-describedby'
          )
        )
    )
    assert.equal(new Set(ids).size, ids.length)
    assert.ok(ids.every(id => id.length > 0))
  })

  it('hides the flag emoji from assistive tech', async () => {
    const host = await supportUkraineBlock({ dontRepeat: false })
    const banner = bannerOf(host)
    const link = banner.firstChild as MockElement
    const flag = link.querySelector('.support-ukraine-block__flag') as MockElement
    const hidden = (flag as unknown as { getAttribute: (n: string) => string }).getAttribute(
      'aria-hidden'
    )
    assert.equal(hidden, 'true')
  })

  it('hides the refresh glyph — the button name comes from aria-label', async () => {
    const host = await supportUkraineBlock({ showRefreshButton: true, dontRepeat: false })
    const banner = bannerOf(host)
    const refresh = banner.children.find(
      child => child.className === 'support-ukraine-block__refresh'
    )
    assert.ok(refresh, 'refresh button found')
    const label = (refresh as unknown as { getAttribute: (n: string) => string }).getAttribute(
      'aria-label'
    )
    assert.ok(label.length > 0)
    const glyph = refresh.firstChild as unknown as { getAttribute: (n: string) => string }
    assert.equal(glyph.getAttribute('aria-hidden'), 'true')
    assert.equal(refresh.textContent, '⟳') // U+27F3 refresh glyph.
  })
})

// ── contrast (prefers-contrast: more + forced-colors) ───────────────────

describe('contrast', () => {
  const css = styles.replaceAll(/\s+/g, ' ')
  it('lifts the dimmed parts to full opacity without text-shadow under prefers-contrast: more', () => {
    assert.match(css, /prefers-contrast: *more/)
    for (const part of ['__link', '__more', '__refresh']) {
      const rule = new RegExp(`prefers-contrast: *more.*?${part}.*?opacity: *1`, 'u')
      assert.match(css, rule, `${part} must reach opacity 1 under prefers-contrast: more`)
    }
    assert.match(
      css,
      /prefers-contrast: *more.*?text-shadow: *none/,
      'more-contrast text must drop its shadow'
    )
  })
  it('keeps every banner pair at axe color-contrast-enhanced (7:1) under prefers-contrast: more', () => {
    assert.ok(contrastRatio('#ffffff', '#003580') >= 7, 'light more-contrast pair must reach 7:1')
    assert.ok(contrastRatio('#000000', '#ffd700') >= 7, 'dark more-contrast pair must reach 7:1')
    assert.match(
      css,
      /prefers-contrast: *more.*?background-color: *#003580/,
      'more-contrast must darken the light background'
    )
  })
  it('keeps a real focus outline under forced-colors: active', () => {
    assert.match(css, /forced-colors: *active/, 'banner must answer forced-colors')
    for (const part of ['__link', '__more', '__refresh']) {
      const rule = new RegExp(`forced-colors: *active.*?${part}.*?outline: *2px solid`, 'u')
      assert.match(css, rule, `${part} focus outline must survive forced colors`)
    }
    assert.match(
      css,
      /forced-colors: *active.*?Highlight/,
      'forced-colors outline must use a system color'
    )
  })
})

// ── showRefreshButton ────────────────────────────────────────────────

describe('showRefreshButton', () => {
  before(() => {
    setupDom()
    setupStorage()
  })

  beforeEach(() => {
    storage.store.clear()
    head.children.length = 0
  })

  it('does not render refresh button by default', async () => {
    const host = await supportUkraineBlock({ dontRepeat: false })
    const banner = bannerOf(host)
    const refresh = banner.children.find(
      child => child.className === 'support-ukraine-block__refresh'
    )
    assert.equal(refresh, undefined)
  })

  it('renders refresh button when showRefreshButton is true', async () => {
    const host = await supportUkraineBlock({
      showRefreshButton: true,
      dontRepeat: false
    })
    const banner = bannerOf(host)
    const refresh = banner.children.find(
      child => child.className === 'support-ukraine-block__refresh'
    )
    assert.ok(refresh, 'refresh button should exist')
    assert.equal(refresh.textContent, '\u{27F3}')
  })

  it('refresh button is placed before the more link', async () => {
    const host = await supportUkraineBlock({
      showRefreshButton: true,
      dontRepeat: false
    })
    const banner = bannerOf(host)
    const refreshIndex = banner.children.findIndex(
      child => child.className === 'support-ukraine-block__refresh'
    )
    const moreIndex = banner.children.findIndex(
      child => child.className === 'support-ukraine-block__more'
    )
    assert.ok(refreshIndex !== -1, 'refresh button found')
    assert.ok(moreIndex !== -1, 'more link found')
    assert.ok(refreshIndex < moreIndex, 'refresh button is before more link')
  })

  it('clicking refresh button changes the displayed charity', async () => {
    const host = await supportUkraineBlock({
      showRefreshButton: true,
      dontRepeat: false
    })
    const banner = bannerOf(host)
    const link = banner.firstChild as unknown as { href: string }

    const refresh = banner.children.find(
      child => child.className === 'support-ukraine-block__refresh'
    )
    assert.ok(refresh, 'refresh button found')
    refresh.click()

    assert.ok(link.href.length > 0, 'link still has a valid href after refresh')
  })
})

// ── refreshOnClick ────────────────────────────────────────────────

describe('refreshOnClick', () => {
  const twoCharities: Charity[] = [
    {
      id: 'click-a',
      name: 'Charity A',
      tagline: 'Tagline A',
      urls: { en: 'https://a.example.org' },
      tags: ['humanitarian']
    },
    {
      id: 'click-b',
      name: 'Charity B',
      tagline: 'Tagline B',
      urls: { en: 'https://b.example.org' },
      tags: ['humanitarian']
    }
  ]

  before(() => {
    setupDom()
    setupStorage()
    setupWindow()
  })

  beforeEach(() => {
    storage.store.clear()
    resetMemorySeen()
    documentListeners.clear()
    setupWindow()
    setDocumentHidden(false)
    head.children.length = 0
    body.children.length = 0
  })

  afterEach(() => {
    body.children.length = 0
  })

  it('keeps the banner while visible, rotates once the page hides after a click', async () => {
    const host = await supportUkraineBlock({ charities: twoCharities })
    const before = bannerName(host)
    const banner = bannerOf(host)
    const link = banner.firstChild as MockElement
    link.click()
    assert.equal(bannerName(host), before, 'nothing swaps in front of the visitor')
    setDocumentHidden(true)
    fireDocumentEvent()
    assert.notEqual(bannerName(host), before)
  })

  it('rotates on window blur after a click', async () => {
    const host = await supportUkraineBlock({ charities: twoCharities })
    const before = bannerName(host)
    const banner = bannerOf(host)
    const link = banner.firstChild as MockElement
    link.click()
    fireWindowEvent()
    assert.notEqual(bannerName(host), before)
  })

  it('keeps the charity when refreshOnClick is false', async () => {
    const host = await supportUkraineBlock({ charities: twoCharities, refreshOnClick: false })
    const before = bannerName(host)
    const banner = bannerOf(host)
    const link = banner.firstChild as MockElement
    link.click()
    fireWindowEvent()
    setDocumentHidden(true)
    fireDocumentEvent()
    assert.equal(bannerName(host), before)
  })

  it('rotates after refreshOnClickDelay when focus never leaves', async () => {
    const host = await supportUkraineBlock({ charities: twoCharities, refreshOnClickDelay: 150 })
    const before = bannerName(host)
    const banner = bannerOf(host)
    const link = banner.firstChild as MockElement
    link.click()
    assert.equal(bannerName(host), before, 'nothing swaps before the delay elapses')
    await new Promise(resolve => setTimeout(resolve, 550))
    assert.notEqual(bannerName(host), before)
  })

  it('does not throw with a single charity', async () => {
    const single = twoCharities[0]
    assert.ok(single)
    const host = await supportUkraineBlock({ charities: [single] })
    const banner = bannerOf(host)
    const link = banner.firstChild as MockElement
    link.click()
    fireWindowEvent()
    assert.equal(bannerName(host), 'Charity A')
  })

  it('destroy cancels a pending click rotation', async () => {
    const host = await supportUkraineBlock({ charities: twoCharities, refreshOnClickDelay: 30 })
    const banner = bannerOf(host)
    const link = banner.firstChild as MockElement
    link.click()
    host.destroy()
    fireWindowEvent()
    setDocumentHidden(true)
    fireDocumentEvent()
    assert.equal(body.children.length, 0, 'host stays removed, no rotation revives it')
  })
})

// ── autoRefreshInterval ─────────────────────────────────────────────

interface FakeIntervals {
  started: Array<{ id: number; callback: () => void }>
  cleared: number[]
  restore: () => void
}

// Captures the auto-refresh intervals so the test drives them without a real timer.
function stubIntervals(): FakeIntervals {
  const started: FakeIntervals['started'] = []
  const cleared: number[] = []
  const globals = globalThis as unknown as Record<string, unknown>
  const originalSetInterval = globals.setInterval
  const originalClearInterval = globals.clearInterval
  let nextId = 1
  globals.setInterval = (callback: () => void) => {
    const id = nextId++
    started.push({ id, callback })
    return id
  }
  globals.clearInterval = (id: number) => {
    cleared.push(id)
  }
  return {
    started,
    cleared,
    restore() {
      globals.setInterval = originalSetInterval
      globals.clearInterval = originalClearInterval
    }
  }
}

describe('autoRefreshInterval', () => {
  let intervals: FakeIntervals

  before(() => {
    setupDom()
    setupStorage()
    intervals = stubIntervals()
  })

  after(() => {
    intervals.restore()
  })

  beforeEach(() => {
    storage.store.clear()
    head.children.length = 0
    body.children.length = 0
    intervals.started.length = 0
    intervals.cleared.length = 0
  })

  it('does not start timer when interval is 0 (default)', async () => {
    const host = await supportUkraineBlock({ dontRepeat: false })
    assert.ok(host.destroy, 'destroy method exists')
    assert.equal(intervals.started.length, 0, 'no interval is started')
    host.destroy()
  })

  it('starts timer when interval > 0', async () => {
    const host = await supportUkraineBlock({
      autoRefreshInterval: 50,
      dontRepeat: false
    })
    assert.ok(host.destroy, 'destroy method exists')
    assert.equal(intervals.started.length, 1, 'one interval is started')
    host.destroy()
  })

  it('destroy clears the interval', async () => {
    const host = await supportUkraineBlock({
      autoRefreshInterval: 50,
      dontRepeat: false
    })
    const intervalId = intervals.started[0]?.id
    host.destroy()
    assert.deepEqual(intervals.cleared, [intervalId], 'destroy clears the auto-refresh interval')
  })

  it('rotates the banner on the interval', async () => {
    const calls: string[] = []
    const originalInfo = console.info
    console.info = (...arguments_: unknown[]) => {
      calls.push(arguments_.map(String).join(' '))
    }
    await withRandom([0, 0], async () => {
      const host = await supportUkraineBlock({
        charities: rotationCharities,
        autoRefreshInterval: 30,
        dontRepeat: false
      })
      try {
        const interval = intervals.started[0]
        assert.ok(interval, 'the banner starts an interval')
        interval.callback()
        assert.ok(calls.length > 1, 'the banner must rotate on the interval')
        assert.equal(bannerName(host), 'Rot B', 'the interval shows the next charity')
      } finally {
        console.info = originalInfo
        host.destroy()
      }
    })
  })

  it('destroy removes the host element from the DOM', async () => {
    const host = await supportUkraineBlock({ dontRepeat: false })
    assert.equal(body.children.length, 1)
    host.destroy()
    assert.equal(body.children.length, 0, 'host should be removed from DOM after destroy')
  })
})

// ── showRefreshAnimation ────────────────────────────────────────────

describe('showRefreshAnimation', () => {
  before(() => {
    setupDom()
    setupStorage()
  })

  beforeEach(() => {
    storage.store.clear()
    head.children.length = 0
  })

  it('does not add refreshing class by default', async () => {
    const host = await supportUkraineBlock({
      showRefreshButton: true,
      dontRepeat: false
    })
    const banner = bannerOf(host)
    const refresh = banner.children.find(
      child => child.className === 'support-ukraine-block__refresh'
    )
    assert.ok(refresh, 'refresh button found')
    refresh.click()
    assert.ok(!banner.className.includes('--refreshing'), 'should not have refreshing class')
  })

  it('does not add refreshing class when showRefreshAnimation is false', async () => {
    const host = await supportUkraineBlock({
      showRefreshButton: true,
      showRefreshAnimation: false,
      dontRepeat: false
    })
    const banner = bannerOf(host)
    const refresh = banner.children.find(
      child => child.className === 'support-ukraine-block__refresh'
    )
    assert.ok(refresh, 'refresh button found')
    refresh.click()
    assert.ok(!banner.className.includes('--refreshing'), 'should not have refreshing class')
  })

  it('adds and removes refreshing class when showRefreshAnimation is true', async () => {
    const manyCharities: Charity[] = Array.from({ length: 50 }, (_, index) => ({
      id: `charity-${index}`,
      name: `Charity ${index}`,
      tagline: `Tagline ${index}`,
      urls: { en: `https://charity-${index}.example.org` },
      tags: ['humanitarian']
    }))
    const host = await supportUkraineBlock({
      showRefreshButton: true,
      showRefreshAnimation: true,
      dontRepeat: false,
      charities: manyCharities
    })
    const banner = bannerOf(host)
    const link = banner.firstChild as unknown as { href: string }
    const before = link.href
    const refresh = banner.children.find(
      child => child.className === 'support-ukraine-block__refresh'
    )
    assert.ok(refresh, 'refresh button found')

    refresh.click()
    assert.ok(banner.className.includes('--refreshing'), 'refreshing class added immediately')

    await new Promise(resolve => setTimeout(resolve, 250))
    assert.ok(!banner.className.includes('--refreshing'), 'refreshing class removed after timeout')
    assert.notEqual(link.href, before, 'charity changed after animation')
  })
})

// ── UTM parameters ──────────────────────────────────────────────────────

describe('UTM parameters', () => {
  before(() => {
    setupDom()
    setupStorage()
    setupWindow()
  })

  beforeEach(() => {
    storage.store.clear()
    head.children.length = 0
    body.children.length = 0
    setupWindow()
  })

  it('adds UTM parameters by default', async () => {
    const host = await supportUkraineBlock({ dontRepeat: false, tags: ['animals'] })
    const banner = bannerOf(host)
    const link = banner.firstChild as unknown as { href: string }

    assert.ok(link.href.includes('utm_source=example.com'), 'should include utm_source')
    assert.ok(link.href.includes('utm_medium=support-ukraine-banner'), 'should include utm_medium')
  })

  it('does not add UTM parameters when utmEnabled is false', async () => {
    const host = await supportUkraineBlock({
      utmEnabled: false,
      dontRepeat: false,
      tags: ['animals']
    })
    const banner = bannerOf(host)
    const link = banner.firstChild as unknown as { href: string }

    assert.ok(!link.href.includes('utm_source'), 'should not include utm_source')
    assert.ok(!link.href.includes('utm_medium'), 'should not include utm_medium')
  })

  it('uses custom utmSource when provided', async () => {
    const host = await supportUkraineBlock({
      utmSource: 'custom-domain.com',
      dontRepeat: false,
      tags: ['animals']
    })
    const banner = bannerOf(host)
    const link = banner.firstChild as unknown as { href: string }

    assert.ok(link.href.includes('utm_source=custom-domain.com'), 'should use custom utm_source')
  })

  it('uses custom utmMedium when provided', async () => {
    const host = await supportUkraineBlock({
      utmMedium: 'custom-medium',
      dontRepeat: false,
      tags: ['animals']
    })
    const banner = bannerOf(host)
    const link = banner.firstChild as unknown as { href: string }

    assert.ok(link.href.includes('utm_medium=custom-medium'), 'should use custom utm_medium')
  })

  it('respects Do-Not-Track header', async () => {
    const originalNavigator = navigator
    // eslint-disable-next-line unicorn/no-global-object-property-assignment
    globalThis.navigator = { doNotTrack: '1' }

    const host = await supportUkraineBlock({ dontRepeat: false, tags: ['animals'] })
    const banner = bannerOf(host)
    const link = banner.firstChild as unknown as { href: string }

    assert.ok(!link.href.includes('utm_source'), 'should not add UTM when DNT is enabled')

    // eslint-disable-next-line unicorn/no-global-object-property-assignment
    globalThis.navigator = originalNavigator
  })

  it('respects window.doNotTrack', async () => {
    const originalNavigator = navigator
    const originalWindow = globalThis.window
    // eslint-disable-next-line unicorn/no-global-object-property-assignment
    globalThis.navigator = { doNotTrack: 'no' }
    // eslint-disable-next-line unicorn/no-global-object-property-assignment
    globalThis.window = { doNotTrack: 'yes', location: { hostname: 'test.com' } }

    const host = await supportUkraineBlock({ dontRepeat: false, tags: ['animals'] })
    const banner = bannerOf(host)
    const link = banner.firstChild as unknown as { href: string }

    assert.ok(!link.href.includes('utm_source'), 'should not add UTM when window.doNotTrack is yes')

    // eslint-disable-next-line unicorn/no-global-object-property-assignment
    globalThis.navigator = originalNavigator
    // eslint-disable-next-line unicorn/no-global-object-property-assignment
    globalThis.window = originalWindow
  })

  it('respects navigator.msDoNotTrack', async () => {
    const originalNavigator = navigator
    // eslint-disable-next-line unicorn/no-global-object-property-assignment
    globalThis.navigator = { doNotTrack: 'no', msDoNotTrack: '1' }

    const host = await supportUkraineBlock({ dontRepeat: false, tags: ['animals'] })
    const banner = bannerOf(host)
    const link = banner.firstChild as unknown as { href: string }

    assert.ok(!link.href.includes('utm_source'), 'should not add UTM when msDoNotTrack is 1')

    // eslint-disable-next-line unicorn/no-global-object-property-assignment
    globalThis.navigator = originalNavigator
  })

  it('applies UTM to more link as well', async () => {
    const host = await supportUkraineBlock({ dontRepeat: false, tags: ['animals'] })
    const banner = bannerOf(host)
    const moreLink = banner.children.find(
      child => child.className === 'support-ukraine-block__more'
    )
    assert.ok(moreLink, 'more link found')

    assert.ok(
      moreLink.href.includes('utm_source=example.com'),
      'more link should include utm_source'
    )
    assert.ok(
      moreLink.href.includes('utm_medium=support-ukraine-banner'),
      'more link should include utm_medium'
    )
  })

  it('applies UTM on refresh', async () => {
    const manyCharities: Charity[] = Array.from({ length: 50 }, (_, index) => ({
      id: `charity-${index}`,
      name: `Charity ${index}`,
      tagline: `Tagline ${index}`,
      urls: { en: `https://charity-${index}.example.org` },
      tags: ['humanitarian']
    }))

    const host = await supportUkraineBlock({
      showRefreshButton: true,
      dontRepeat: false,
      charities: manyCharities
    })
    const banner = bannerOf(host)
    const link = banner.firstChild as unknown as { href: string }
    const firstHref = link.href

    const refresh = banner.children.find(
      child => child.className === 'support-ukraine-block__refresh'
    )
    assert.ok(refresh, 'refresh button found')
    refresh.click()

    assert.ok(
      link.href.includes('utm_source=example.com'),
      'refreshed link should include utm_source'
    )
    assert.ok(
      link.href.includes('utm_medium=support-ukraine-banner'),
      'refreshed link should include utm_medium'
    )
    assert.notEqual(link.href, firstHref, 'charity should change on refresh')
  })
})

// ── isInConsole ───────────────────────────────────────────────────────

describe('isInConsole', () => {
  let originalInfo: typeof console.info
  let calls: string[]

  before(() => {
    setupDom()
    setupStorage()
  })

  beforeEach(() => {
    storage.store.clear()
    head.children.length = 0
    body.children.length = 0
    calls = []
    originalInfo = console.info
    console.info = (...arguments_: unknown[]) => {
      calls.push(arguments_.map(String).join(' '))
    }
  })

  afterEach(() => {
    console.info = originalInfo
  })

  it('logs to console by default', async () => {
    await supportUkraineBlock({ dontRepeat: false })
    assert.ok(calls.length > 0, 'console.info should be called')
    assert.ok(
      calls.some(c => c.includes('[support-ukraine]')),
      'should log with prefix'
    )
  })

  it('does not log when isInConsole is false', async () => {
    await supportUkraineBlock({ isInConsole: false, dontRepeat: false })
    assert.equal(calls.length, 0, 'console.info should not be called')
  })
})

// ── injectStyles ──────────────────────────────────────────────────────

describe('injectShadowStyles', () => {
  before(() => {
    setupDom()
    setupStorage()
  })

  beforeEach(() => {
    storage.store.clear()
    head.children.length = 0
  })

  it('injects the stylesheet once per shadow root', async () => {
    const host = await supportUkraineBlock({ dontRepeat: false })
    const root = shadowOf(host)
    const injected = root.children.filter(child => child.tagName === 'STYLE')
    assert.equal(injected.length, 1, 'the shadow root holds one style')
    assert.equal(injected[0]?.id, 'support-ukraine-block-styles')

    injectShadowStyles(root as unknown as ShadowRoot)
    assert.equal(
      root.children.filter(child => child.tagName === 'STYLE').length,
      1,
      'the stylesheet must not be injected twice'
    )
  })
})

// ── per-locale entries ───────────────────────────────────────────────────

// Literal specifiers, one per locale — a computed `import(`../src/entries/${locale}.js`)`
// can't be bundled by esbuild/tsup, same reason a bundler can't resolve it in consumer code.
const entryLoaders: Record<
  string,
  () => Promise<{ supportUkraineBlock: typeof supportUkraineBlock }>
> = {
  ar: () => import('../src/entries/ar.js'),
  de: () => import('../src/entries/de.js'),
  en: () => import('../src/entries/en.js'),
  es: () => import('../src/entries/es.js'),
  fr: () => import('../src/entries/fr.js'),
  hi: () => import('../src/entries/hi.js'),
  it: () => import('../src/entries/it.js'),
  ja: () => import('../src/entries/ja.js'),
  ko: () => import('../src/entries/ko.js'),
  nl: () => import('../src/entries/nl.js'),
  pl: () => import('../src/entries/pl.js'),
  pt: () => import('../src/entries/pt.js'),
  sv: () => import('../src/entries/sv.js'),
  th: () => import('../src/entries/th.js'),
  uk: () => import('../src/entries/uk.js'),
  zh: () => import('../src/entries/zh.js')
}

describe('per-locale entries', () => {
  before(() => {
    setupDom()
    setupStorage()
  })

  beforeEach(() => {
    storage.store.clear()
    head.children.length = 0
    body.children.length = 0
  })

  for (const locale of Object.keys(localeLoaders)) {
    it(`${locale} entry mounts lang="${locale}" with its own messages`, async () => {
      const loadEntry = entryLoaders[locale]
      assert.ok(loadEntry, `entry loader for ${locale}`)
      const { supportUkraineBlock: localizedBlock } = await loadEntry()
      const host = await localizedBlock({ dontRepeat: false })
      const banner = bannerOf(host)
      assert.equal((banner as unknown as { lang: string }).lang, locale)

      const expected = await loadLocale(locale)
      const link = banner.firstChild as MockElement
      const prefix = link.querySelector('.support-ukraine-block__prefix') as MockElement
      assert.ok(
        prefix.textContent.includes(expected.supportUkraine),
        `${locale} entry should bundle its own locale's messages`
      )

      const direction = (banner as unknown as { getAttribute: (n: string) => string }).getAttribute(
        'dir'
      )
      if (locale === 'ar') {
        assert.equal(direction, 'rtl')
      } else {
        assert.notEqual(direction, 'rtl')
      }

      const label = (banner as unknown as { getAttribute: (n: string) => string }).getAttribute(
        'aria-label'
      )
      assert.equal(label, expected.regionLabel)
    })
  }

  it('ignores the locale option — the bundle is already localized', async () => {
    const loadEs = entryLoaders.es
    assert.ok(loadEs, 'entry loader for es')
    const { supportUkraineBlock: esBlock } = await loadEs()
    const host = await esBlock({ locale: 'fr', dontRepeat: false })
    const banner = bannerOf(host)
    assert.equal((banner as unknown as { lang: string }).lang, 'es')
  })
})

// ── charity validation ────────────────────────────────────────────────────

describe('charity validation', () => {
  const valid = {
    id: 'valid-id',
    name: 'Valid Charity',
    tagline: 'A valid tagline',
    urls: { en: 'https://valid.example.org' },
    tags: ['military']
  }

  it('parses a single charity', () => {
    const parsed = charitySchema.parse(valid)
    assert.equal(parsed.id, 'valid-id')
    assert.equal(parsed.urls.en, 'https://valid.example.org')
    assert.deepEqual(parsed.tags, ['military'])
  })

  it('rejects a null charity', () => {
    // eslint-disable-next-line unicorn/no-null
    assert.throws(() => charitiesSchema.parse([null]), /Charity must be an object/)
  })

  it('rejects a string charity', () => {
    assert.throws(() => charitiesSchema.parse(['nope']), /Charity must be an object/)
  })

  it('requires a string id', () => {
    assert.throws(() => charitiesSchema.parse([{ ...valid, id: 42 }]), /id must be a string/)
  })

  it('requires a non-empty id', () => {
    assert.throws(() => charitiesSchema.parse([{ ...valid, id: '' }]), /id must not be empty/)
  })

  it('requires a string name', () => {
    assert.throws(() => charitiesSchema.parse([{ ...valid, name: 7 }]), /name must be a string/)
  })

  it('requires a non-empty name', () => {
    assert.throws(() => charitiesSchema.parse([{ ...valid, name: '' }]), /name must not be empty/)
  })

  it('requires a string tagline', () => {
    assert.throws(
      () => charitiesSchema.parse([{ ...valid, tagline: 7 }]),
      /tagline must be a string/
    )
  })

  it('requires a non-empty tagline', () => {
    assert.throws(
      () => charitiesSchema.parse([{ ...valid, tagline: '' }]),
      /tagline must not be empty/
    )
  })

  it('requires tags to be an array', () => {
    assert.throws(
      () => charitiesSchema.parse([{ ...valid, tags: 'military' }]),
      /tags must be an array/
    )
  })

  it('requires at least one tag', () => {
    assert.throws(() => charitiesSchema.parse([{ ...valid, tags: [] }]), /tags must not be empty/)
  })

  it('requires a urls object', () => {
    // eslint-disable-next-line unicorn/no-null
    assert.throws(() => charitiesSchema.parse([{ ...valid, urls: null }]), /urls must be an object/)
  })

  it('requires a non-empty urls object', () => {
    assert.throws(() => charitiesSchema.parse([{ ...valid, urls: {} }]), /urls must not be empty/)
  })

  it('names the offending url key', () => {
    const urls = { en: 'https://valid.example.org', de: 'nope' }
    assert.throws(() => charitiesSchema.parse([{ ...valid, urls }]), /urls\.de must be a valid URL/)
  })

  it('requires the url values to be strings', () => {
    const urls = { en: 42 }
    assert.throws(() => charitiesSchema.parse([{ ...valid, urls }]), /urls\.en must be a string/)
  })

  it('lists the valid tags when a tag is unknown', () => {
    assert.throws(
      () => charitiesSchema.parse([{ ...valid, tags: ['invalid'] }]),
      /Invalid tag: invalid\. Must be one of: military, humanitarian, animals/
    )
  })

  it('requires an array of charities', () => {
    assert.throws(() => charitiesSchema.parse({}), /Charities must be an array/)
  })
})

// ── banner structure ──────────────────────────────────────────────────────

describe('banner structure', () => {
  before(() => {
    setupDom()
    setupStorage()
  })

  beforeEach(() => {
    storage.store.clear()
    head.children.length = 0
    body.children.length = 0
  })

  it('mounts a div host with an open shadow root', async () => {
    const host = (await supportUkraineBlock({ dontRepeat: false })) as unknown as MockElement
    assert.equal(host.tagName, 'DIV')
    assert.equal(host.shadowMode, 'open')
  })

  it('renders the banner section with its mode class', async () => {
    const host = await supportUkraineBlock({ dontRepeat: false })
    const banner = bannerOf(host)
    assert.equal(banner.className, 'support-ukraine-block support-ukraine-block--shift')
  })

  it('renders the donation link', async () => {
    const host = await supportUkraineBlock({ dontRepeat: false })
    const link = bannerOf(host).firstChild as MockElement
    assert.equal(link.tagName, 'A')
    assert.equal(link.className, 'support-ukraine-block__link')
    assert.equal(link.target, '_blank')
    assert.equal(link.rel, 'noopener noreferrer')
    assert.equal(link.style.fontSize, '87.5%')
  })

  it('renders the flag, the prefix and the info block inside the link', async () => {
    const host = await supportUkraineBlock({ dontRepeat: false, locale: 'en' })
    const link = bannerOf(host).firstChild as MockElement
    const [flag, prefix, info] = link.children
    assert.equal(flag?.tagName, 'SPAN')
    assert.equal(flag?.className, 'support-ukraine-block__flag')
    assert.equal(flag?.textContent, '🇺🇦 ')
    assert.equal(prefix?.tagName, 'SPAN')
    assert.equal(prefix?.className, 'support-ukraine-block__prefix')
    assert.equal(prefix?.textContent, 'Support Ukraine with ')
    assert.equal(info?.tagName, 'SPAN')
    assert.equal(info?.className, 'support-ukraine-block__info')
  })

  it('renders the charity name, the colon and the tagline', async () => {
    const charity = DEFAULT_CHARITIES[0]
    assert.ok(charity)
    const host = await supportUkraineBlock({
      charities: [charity],
      locale: 'en',
      dontRepeat: false
    })
    const info = (bannerOf(host).firstChild as MockElement).lastChild as MockElement
    const [name, colon, tagline] = info.children
    assert.equal(name?.tagName, 'SPAN')
    assert.equal(name?.className, 'support-ukraine-block__name')
    assert.equal(name?.textContent, charity.name)
    assert.equal(colon?.tagName, 'SPAN')
    assert.equal(colon?.className, 'support-ukraine-block__colon')
    assert.equal(colon?.textContent, ': ')
    assert.equal(tagline?.tagName, 'SPAN')
    assert.equal(tagline?.className, 'support-ukraine-block__tagline')
    assert.equal(tagline?.textContent, charity.tagline)
  })

  it('renders the more link with its text and ellipsis', async () => {
    const host = await supportUkraineBlock({ dontRepeat: false, locale: 'en' })
    const banner = bannerOf(host)
    const more = banner.children.find(child => child.className === 'support-ukraine-block__more')
    assert.ok(more)
    assert.equal(more.tagName, 'A')
    assert.equal(more.target, '_blank')
    assert.equal(more.rel, 'noopener noreferrer')
    const [text, ellipsis] = more.children
    assert.equal(text?.tagName, 'SPAN')
    assert.equal(text?.className, 'support-ukraine-block__more-text')
    assert.equal(text?.textContent, 'more…')
    assert.equal(ellipsis?.tagName, 'SPAN')
    assert.equal(ellipsis?.className, 'support-ukraine-block__more-ellipsis')
    assert.equal(ellipsis?.textContent, '…')
  })

  it('appends a visually hidden new-tab hint for both links', async () => {
    const host = await supportUkraineBlock({ dontRepeat: false })
    const banner = bannerOf(host)
    const hints = banner.children.filter(
      child => child.className === 'support-ukraine-block__visually-hidden'
    )
    assert.equal(hints.length, 2)
    for (const hint of hints) {
      assert.equal(hint.tagName, 'SPAN')
      assert.match(hint.id, /^support-ukraine-block-(link|more)-new-tab-\d+$/)
    }
    const link = banner.firstChild as MockElement
    const linkHint = hints.find(hint => hint.id.includes('link-new-tab'))
    assert.ok(linkHint)
    assert.equal(link.getAttribute('aria-describedby'), linkHint.id)
  })

  it('marks the host as processed', async () => {
    const host = await supportUkraineBlock({ dontRepeat: false })
    assert.equal(host.dataset.supportUkraine, '')
    assert.ok(host.className.includes('support-ukraine-block--processed'))
  })

  it('renders the refresh button as a real button', async () => {
    const host = await supportUkraineBlock({ showRefreshButton: true, dontRepeat: false })
    const banner = bannerOf(host)
    const refresh = banner.children.find(
      child => child.className === 'support-ukraine-block__refresh'
    )
    assert.ok(refresh)
    assert.equal(refresh.tagName, 'BUTTON')
    assert.equal(refresh.type, 'button')
    const glyph = refresh.firstChild as MockElement
    assert.equal(glyph.tagName, 'SPAN')
    assert.equal(glyph.getAttribute('aria-hidden'), 'true')
  })
})

// ── rotation policy ───────────────────────────────────────────────────────

describe('rotation policy', () => {
  before(() => {
    setupDom()
    setupStorage()
  })

  beforeEach(() => {
    storage.store.clear()
    resetMemorySeen()
    head.children.length = 0
    body.children.length = 0
  })

  it('keeps the same charity when dontRepeat is false', async () => {
    await withRandom([0, 0], async () => {
      const first = await supportUkraineBlock({ charities: rotationCharities, dontRepeat: false })
      const second = await supportUkraineBlock({ charities: rotationCharities, dontRepeat: false })
      assert.equal(bannerName(first), 'Rot A')
      assert.equal(bannerName(second), 'Rot A')
    })
  })

  it('avoids repeats by default', async () => {
    await withRandom([0, 0], async () => {
      const first = await supportUkraineBlock({ charities: rotationCharities })
      const second = await supportUkraineBlock({ charities: rotationCharities })
      assert.equal(bannerName(first), 'Rot A')
      assert.equal(bannerName(second), 'Rot B')
    })
  })

  it('clears the seen list once every charity has been shown', async () => {
    await withRandom([0, 0.4, 0.8, 0, 0.2], async () => {
      for (let index = 0; index < 4; index++) {
        await supportUkraineBlock({ charities: rotationCharities })
      }
      const fifth = await supportUkraineBlock({ charities: rotationCharities })
      assert.equal(bannerName(fifth), 'Rot B')
    })
  })

  it('forgets the seen charities when the session is reset', async () => {
    await withRandom([0, 0], async () => {
      const first = await supportUkraineBlock({ charities: rotationCharities })
      assert.equal(bannerName(first), 'Rot A')
      resetMemorySeen()
      const second = await supportUkraineBlock({ charities: rotationCharities })
      assert.equal(bannerName(second), 'Rot A')
    })
  })

  it('does not persist the seen list when dontRepeat is false', async () => {
    await supportUkraineBlock({
      charities: rotationCharities,
      dontRepeat: false,
      persistSeen: true
    })
    assert.equal(storage.store.size, 0, 'a disabled repeat guard must not write to localStorage')
  })

  it('degrades to an empty seen list when localStorage is unavailable', async () => {
    const savedGetItem = localStorage.getItem
    localStorage.getItem = () => {
      throw new Error('storage denied')
    }
    try {
      await withRandom([0], async () => {
        const host = await supportUkraineBlock({
          charities: rotationCharities,
          persistSeen: true
        })
        assert.equal(bannerName(host), 'Rot A')
      })
    } finally {
      localStorage.getItem = savedGetItem
    }
  })
})

// ── rotation excludes the current charity ─────────────────────────────────

describe('rotation exclusions', () => {
  before(() => {
    setupDom()
    setupStorage()
  })

  beforeEach(() => {
    storage.store.clear()
    resetMemorySeen()
    head.children.length = 0
    body.children.length = 0
  })

  it('excludes the current charity id', async () => {
    await withRandom([0, 0], async () => {
      const host = await supportUkraineBlock({
        charities: sharedUrlCharities,
        dontRepeat: false,
        showRefreshButton: true
      })
      assert.equal(bannerName(host), 'Shared A')
      refreshButtonOf(host).click()
      assert.equal(bannerName(host), 'Shared B')
    })
  })

  it('excludes charities sharing the current donation url', async () => {
    await withRandom([0, 0], async () => {
      const host = await supportUkraineBlock({
        charities: mixedUrlCharities,
        dontRepeat: false,
        showRefreshButton: true
      })
      assert.equal(bannerName(host), 'Mix A')
      refreshButtonOf(host).click()
      assert.equal(bannerName(host), 'Mix C')
    })
  })

  it('keeps a charity that carries one of the requested tags', async () => {
    const tagged: Charity[] = [
      {
        id: 'single-tag',
        name: 'Single Tag',
        tagline: 'One tag',
        urls: { en: 'https://single.example.org' },
        tags: ['animals']
      },
      {
        id: 'multi-tag',
        name: 'Multi Tag',
        tagline: 'Two tags',
        urls: { en: 'https://multi.example.org' },
        tags: ['military', 'humanitarian']
      }
    ]
    await withRandom([0], async () => {
      const host = await supportUkraineBlock({
        charities: tagged,
        tags: ['military'],
        dontRepeat: false
      })
      const link = bannerOf(host).firstChild as MockElement
      assert.ok(link.href.startsWith('https://multi.example.org'), `unexpected href ${link.href}`)
    })
  })
})

// ── refreshOnClick scheduling ─────────────────────────────────────────────

describe('refreshOnClick scheduling', () => {
  before(() => {
    setupDom()
    setupStorage()
    setupWindow()
  })

  beforeEach(() => {
    storage.store.clear()
    resetMemorySeen()
    documentListeners.clear()
    setupWindow()
    setDocumentHidden(false)
    head.children.length = 0
    body.children.length = 0
  })

  afterEach(() => {
    body.children.length = 0
  })

  it('does not rotate while the page stays visible', async () => {
    await withRandom([0, 0], async () => {
      const host = await supportUkraineBlock({
        charities: rotationCharities,
        refreshOnClickDelay: 30
      })
      const link = bannerOf(host).firstChild as MockElement
      link.click()
      fireDocumentEvent()
      assert.equal(bannerName(host), 'Rot A', 'a visible page must not rotate the banner')
    })
  })

  it('does not rotate when refreshOnClick is disabled', async () => {
    await withRandom([0, 0], async () => {
      const host = await supportUkraineBlock({
        charities: rotationCharities,
        refreshOnClick: false,
        refreshOnClickDelay: 30
      })
      const link = bannerOf(host).firstChild as MockElement
      link.click()
      await new Promise(resolve => setTimeout(resolve, 80))
      assert.equal(bannerName(host), 'Rot A', 'the click must not schedule a rotation')
    })
  })

  it('rotates once when the page hides after a click', async () => {
    await withRandom([0, 0, 0], async () => {
      const host = await supportUkraineBlock({
        charities: rotationCharities,
        refreshOnClickDelay: 30
      })
      const link = bannerOf(host).firstChild as MockElement
      link.click()
      setDocumentHidden(true)
      fireDocumentEvent()
      assert.equal(bannerName(host), 'Rot B')
      await new Promise(resolve => setTimeout(resolve, 80))
      assert.equal(bannerName(host), 'Rot B', 'the pending timer must be cancelled')
    })
  })

  it('stops listening for the page visibility after the rotation', async () => {
    await withRandom([0, 0, 0, 0], async () => {
      const host = await supportUkraineBlock({
        charities: rotationCharities,
        refreshOnClickDelay: 30
      })
      const link = bannerOf(host).firstChild as MockElement
      link.click()
      setDocumentHidden(true)
      fireDocumentEvent()
      const afterHide = bannerName(host)
      assert.equal(afterHide, 'Rot B')
      setDocumentHidden(false)
      setDocumentHidden(true)
      fireDocumentEvent()
      assert.equal(bannerName(host), afterHide, 'the visibility listener must be removed')
    })
  })

  it('stops listening for the window blur after the rotation', async () => {
    await withRandom([0, 0, 0, 0], async () => {
      const host = await supportUkraineBlock({
        charities: rotationCharities,
        refreshOnClickDelay: 30
      })
      const link = bannerOf(host).firstChild as MockElement
      link.click()
      fireWindowEvent()
      const afterBlur = bannerName(host)
      assert.equal(afterBlur, 'Rot B')
      fireWindowEvent()
      assert.equal(bannerName(host), afterBlur, 'the blur listener must be removed')
    })
  })

  it('stops listening after the delayed rotation', async () => {
    await withRandom([0, 0, 0, 0], async () => {
      const host = await supportUkraineBlock({
        charities: rotationCharities,
        refreshOnClickDelay: 30
      })
      const link = bannerOf(host).firstChild as MockElement
      link.click()
      await new Promise(resolve => setTimeout(resolve, 80))
      const afterDelay = bannerName(host)
      assert.equal(afterDelay, 'Rot B', 'the delayed rotation happens')
      setDocumentHidden(true)
      fireDocumentEvent()
      assert.equal(bannerName(host), afterDelay, 'the listener must be gone after the rotation')
    })
  })

  it('does not rotate twice after a window blur', async () => {
    await withRandom([0, 0, 0, 0], async () => {
      const host = await supportUkraineBlock({
        charities: rotationCharities,
        refreshOnClickDelay: 30
      })
      const link = bannerOf(host).firstChild as MockElement
      link.click()
      fireWindowEvent()
      const afterBlur = bannerName(host)
      await new Promise(resolve => setTimeout(resolve, 80))
      assert.equal(bannerName(host), afterBlur, 'the pending timer must be cancelled')
    })
  })

  it('cancels the pending rotation when the banner is destroyed', async () => {
    await withRandom([0, 0, 0, 0], async () => {
      const host = await supportUkraineBlock({
        charities: rotationCharities,
        refreshOnClickDelay: 30
      })
      const link = bannerOf(host).firstChild as MockElement
      link.click()
      link.click()
      const before = bannerName(host)
      host.destroy()
      await new Promise(resolve => setTimeout(resolve, 80))
      assert.equal(bannerName(host), before, 'no rotation may happen after destroy')
    })
  })
})

// ── window fallbacks ──────────────────────────────────────────────────────

describe('window fallbacks', () => {
  before(() => {
    setupDom()
    setupStorage()
  })

  beforeEach(() => {
    storage.store.clear()
    resetMemorySeen()
    head.children.length = 0
    body.children.length = 0
  })

  it('mounts and clicks without a window object', async () => {
    await withGlobal('window', undefined, async () => {
      await withRandom([0], async () => {
        const host = await supportUkraineBlock({
          charities: rotationCharities,
          dontRepeat: false,
          refreshOnClickDelay: 30
        })
        const link = bannerOf(host).firstChild as MockElement
        link.click()
        assert.equal(bannerName(host), 'Rot A')
      })
    })
  })

  it('mounts and clicks without window event methods', async () => {
    await withGlobal('window', {}, async () => {
      await withRandom([0], async () => {
        const host = await supportUkraineBlock({
          charities: rotationCharities,
          dontRepeat: false,
          refreshOnClickDelay: 30
        })
        const link = bannerOf(host).firstChild as MockElement
        link.click()
        assert.equal(bannerName(host), 'Rot A')
      })
    })
  })

  it('destroys without window event methods', async () => {
    await withGlobal('window', {}, async () => {
      const host = await supportUkraineBlock({
        charities: rotationCharities,
        dontRepeat: false,
        refreshOnClickDelay: 30
      })
      const link = bannerOf(host).firstChild as MockElement
      link.click()
      host.destroy()
      assert.ok(true, 'destroy did not throw')
    })
  })

  it('destroys without a window object', async () => {
    await withGlobal('window', undefined, async () => {
      const host = await supportUkraineBlock({
        charities: rotationCharities,
        dontRepeat: false,
        refreshOnClickDelay: 30
      })
      const link = bannerOf(host).firstChild as MockElement
      link.click()
      host.destroy()
      assert.ok(true, 'destroy did not throw')
    })
  })
})

// ── Do-Not-Track detection ────────────────────────────────────────────────

describe('Do-Not-Track detection', () => {
  it('reports no DNT when navigator is unavailable', () => {
    withGlobal('navigator', undefined, () => {
      assert.equal(isDoNotTrackEnabled(), false)
    })
  })

  it('accepts the "yes" navigator value', () => {
    withGlobal('navigator', { doNotTrack: 'yes' }, () => {
      assert.equal(isDoNotTrackEnabled(), true)
    })
  })

  it('accepts the "1" window value', () => {
    withGlobal('window', { doNotTrack: '1', location: { hostname: 'example.com' } }, () => {
      assert.equal(isDoNotTrackEnabled(), true)
    })
  })
})

// ── buildUtmUrl ───────────────────────────────────────────────────────────

describe('buildUtmUrl', () => {
  before(() => {
    setupDom()
    setupStorage()
    setupWindow()
  })

  it('adds the configured campaign', () => {
    const url = buildUtmUrl('https://example.org/donate', { utmCampaign: 'spring' })
    assert.ok(url.includes('utm_campaign=spring'), `unexpected url ${url}`)
  })

  it('omits the campaign by default', () => {
    const url = buildUtmUrl('https://example.org/donate', {})
    assert.ok(!url.includes('utm_campaign'), `unexpected url ${url}`)
  })

  it('keeps the base url when it cannot be parsed', () => {
    assert.equal(buildUtmUrl('not-a-url', {}), 'not-a-url')
  })

  it('keeps the base url when the page has no hostname', () => {
    withGlobal('window', { location: undefined }, () => {
      assert.equal(buildUtmUrl('https://example.org/donate', {}), 'https://example.org/donate')
    })
  })
})

// ── console output ────────────────────────────────────────────────────────

describe('console output', () => {
  let originalInfo: typeof console.info
  let calls: string[]

  before(() => {
    setupDom()
    setupStorage()
  })

  beforeEach(() => {
    storage.store.clear()
    resetMemorySeen()
    head.children.length = 0
    body.children.length = 0
    calls = []
    originalInfo = console.info
    console.info = (...arguments_: unknown[]) => {
      calls.push(arguments_.map(String).join(' '))
    }
  })

  afterEach(() => {
    console.info = originalInfo
  })

  it('logs the selected charity on mount', async () => {
    const charity = rotationCharities[0]
    assert.ok(charity)
    await supportUkraineBlock({ charities: [charity], dontRepeat: false })
    assert.ok(
      calls.some(call => call.includes('[support-ukraine] banner')),
      'the banner prefix is logged'
    )
    assert.ok(
      calls.some(call => call.includes('Rot A: Tagline A')),
      'the charity is logged'
    )
  })

  it('logs the next charity when the banner rotates', async () => {
    await withRandom([0, 0], async () => {
      const host = await supportUkraineBlock({
        charities: rotationCharities,
        dontRepeat: false,
        showRefreshButton: true
      })
      assert.equal(bannerName(host), 'Rot A')
      calls.length = 0
      refreshButtonOf(host).click()
      assert.equal(calls.length, 1, 'the rotation logs exactly one line')
      assert.ok(calls[0]?.includes('[support-ukraine] banner'))
      assert.ok(calls[0]?.includes('Rot B: Tagline B'))
    })
  })

  it('does not log the rotation when isInConsole is false', async () => {
    const host = await supportUkraineBlock({
      charities: rotationCharities,
      dontRepeat: false,
      showRefreshButton: true,
      isInConsole: false
    })
    calls.length = 0
    refreshButtonOf(host).click()
    assert.equal(calls.length, 0, 'no rotation log when the console output is off')
  })
})

// ── locale cache ──────────────────────────────────────────────────────────

describe('locale cache', () => {
  it('loads every locale once', async () => {
    resetLocaleCache()
    const savedLoader = localeLoaders.es
    let calls = 0
    localeLoaders.es = () => {
      calls += 1
      return savedLoader()
    }
    try {
      const first = await loadLocale('es')
      const second = await loadLocale('es')
      assert.equal(calls, 1, 'the loader must run once per locale')
      assert.equal(first, second, 'the cached messages must be reused')
    } finally {
      localeLoaders.es = savedLoader
      resetLocaleCache()
    }
  })

  it('falls back to English when a locale loader fails', async () => {
    resetLocaleCache()
    const savedLoader = localeLoaders.es
    localeLoaders.es = () => Promise.reject(new Error('loader failed'))
    try {
      const messages = await loadLocale('es')
      assert.equal(messages.supportUkraine, 'Support Ukraine with')
    } finally {
      localeLoaders.es = savedLoader
      resetLocaleCache()
    }
  })

  it('fails when the English locale cannot be loaded', async () => {
    resetLocaleCache()
    const savedLoader = localeLoaders.en
    localeLoaders.en = () => Promise.reject(new Error('loader failed'))
    try {
      await assert.rejects(loadLocale('en'), /Failed to load locale "en"/)
    } finally {
      localeLoaders.en = savedLoader
      resetLocaleCache()
    }
  })
})
