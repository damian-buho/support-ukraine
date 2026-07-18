<!--
SPDX-FileCopyrightText: 2026 Damián Búho <damian.buho@proton.me>

SPDX-License-Identifier: MIT
-->

# Bookmarklet

Drag the link below to your bookmarks bar to quickly test the Ukraine-support
banner on any website.

## [Support Ukraine](javascript:void%20function(){import(%27https://cdn.jsdelivr.net/npm/@damian-buho/support-ukraine/dist/index.js%27%2B%27?%27%2BDate.now()).then(function(m){m.supportUkraineBlock()})}();)

### How to use

1. Create a new bookmark in your browser.
2. Set the name to **Support Ukraine**.
3. Paste the code below as the URL.
4. Navigate to any website and click the bookmark to inject the banner.

### Bookmarklet code

```js
javascript:void function(){import("https://cdn.jsdelivr.net/npm/@damian-buho/support-ukraine/dist/index.js"+"?"+Date.now()).then(function(m){m.supportUkraineBlock()})}();
```

### What it does

- Dynamically imports the `@damian-buho/support-ukraine` ESM module from
  jsDelivr CDN.
- Calls `supportUkraineBlock()` to display the charity banner at the top of the
  current page.
- Appends a cache-busting `?t=<timestamp>` query parameter to ensure the latest
  published version is always fetched.

### Options

To customize the banner, edit the bookmarklet URL and pass options to
`supportUkraineBlock()`. For example:

```js
// Force Spanish locale and only military charities
m.supportUkraineBlock({ locale: "es", tags: ["military"] })

// Float over content instead of shifting it down
m.supportUkraineBlock({ mode: "overlap" })
```

See `src/types.ts` for the full list of `SupportUkraineBlockOptions`.
