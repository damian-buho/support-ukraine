// SPDX-FileCopyrightText: 2026 Damián Búho <damian.buho@proton.me>
//
// SPDX-License-Identifier: MIT

// Usage: node scripts/a11y-check.mjs — audits the built dist/en.js banner with axe in every theme a host page can ask for.
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { chromium } from 'playwright-core'

const ORIGIN = 'http://fixture.test'
const THEMES = ['', 'light', 'dark']
const SCHEMES = ['light', 'dark']
const CONTRASTS = { 'no-preference': 'color-contrast', more: 'color-contrast-enhanced' }
const axe = createRequire(import.meta.url).resolve('axe-core/axe.min.js')
const charity = {
  id: 'fixture',
  name: 'Fixture Fund',
  tagline: 'Tagline',
  urls: { en: 'https://example.org/' },
  tags: ['humanitarian'],
  is501c3: true
}
const mounts = THEMES.map(
  theme => `<div data-theme="${theme}"><div class="mount"></div></div>`
).join('')
const options = {
  charities: [charity],
  showRefreshButton: true,
  isInConsole: false,
  dontRepeat: false,
  utmEnabled: false
}
const fixture = `<!DOCTYPE html><html lang="en"><head><title>a11y fixture</title></head><body><main>${mounts}</main>
<script type="module">import { supportUkraineBlock } from '/dist/en.js'; for (const element of document.querySelectorAll('.mount')) supportUkraineBlock({ element, ...${JSON.stringify(options)} })</script></body></html>`

const browser = await chromium.launch()
let failures = 0
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  // Serves the fixture and dist/ from disk under one fake origin, so no server is needed.
  await page.route(`${ORIGIN}/**`, async route => {
    const path = new URL(route.request().url()).pathname
    await route.fulfill(
      path === '/'
        ? { contentType: 'text/html', body: fixture }
        : { contentType: 'text/javascript', body: await readFile(`.${path}`) }
    )
  })
  await page.goto(`${ORIGIN}/`)
  await page.waitForFunction(count => {
    const hosts = [...globalThis.document.querySelectorAll('.mount > *')]
    return hosts.length === count && hosts.every(host => host.shadowRoot?.querySelector('section'))
  }, THEMES.length)
  await page.addScriptTag({ path: axe })
  for (const colorScheme of SCHEMES) {
    for (const [contrast, rule] of Object.entries(CONTRASTS)) {
      await page.emulateMedia({ colorScheme, contrast })
      const { violations } = await page.evaluate(
        id => globalThis.axe.run(globalThis.document, { runOnly: [id] }),
        rule
      )
      const nodes = violations.flatMap(violation => violation.nodes)
      console.log(
        `a11y scheme=${colorScheme} contrast=${contrast} rule=${rule} violations=${nodes.length}`
      )
      for (const node of nodes)
        console.log(
          `  FAIL ${node.target.flat().join(' >>> ')} ${node.failureSummary.replaceAll(/\s+/g, ' ')}`
        )
      failures += nodes.length
    }
  }
} finally {
  await browser.close()
}
console.log(`a11y failures=${failures}`)
process.exitCode = failures > 0 ? 1 : 0
