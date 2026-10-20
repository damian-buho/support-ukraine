// SPDX-FileCopyrightText: 2026 Damián Búho <damian.buho@proton.me>
//
// SPDX-License-Identifier: MIT

// Extracts the base language subtag of a BCP 47 tag, e.g. `es` from `es-MX`.
export function baseLanguage(tag: string): string {
  const dash = tag.indexOf('-')
  return (dash === -1 ? tag : tag.slice(0, dash)).toLowerCase()
}
