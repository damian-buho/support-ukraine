# SPDX-FileCopyrightText: 2026 Damián Búho <damian.buho@proton.me>
#
# SPDX-License-Identifier: MIT

set quiet

[private]
default:
    @just --choose || just --list

build:
    npm run build

build-test:
    npm run build:test

test:
    npm test

test-verbose:
    npm run test:verbose

coverage:
    npm run test:coverage

mutation:
    npm run mutation

check-size:
    CI=true npm run check-size

pages:
    node scripts/build-pages.mjs

lint:
    npm run lint
    reuse lint --lines

fix:
    npm run fix

format:
    npm run format

format-check:
    npm run format:check

check-outdated:
    npm outdated || true

update:
    npm update --no-audit --no-fund

audit:
    npm run audit

pipeline: format lint build check-size build-test test

serve:
    npm run serve

publish:
    npm publish
