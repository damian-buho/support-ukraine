// SPDX-FileCopyrightText: 2026 Damián Búho <damian.buho@proton.me>
//
// SPDX-License-Identifier: MIT

// @ts-check
/*
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
const config = {
  _comment:
    "This config was generated using 'stryker init'. Please take a look at: https://stryker-mutator.io/docs/stryker-js/configuration/ for more information.",
  packageManager: 'npm',
  reporters: ['html', 'clear-text', 'progress'],
  testRunner: 'command',
  testRunner_comment:
    "Take a look at (missing 'homepage' URL in package.json) for information about the command plugin.",
  commandRunner: { command: 'npm test' },
  coverageAnalysis: 'off',
  thresholds: { high: 100, low: 100 },
  buildCommand: 'npm run build'
}
export default config
