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

audit:
    npm run audit

pipeline: format lint build build-test test

publish:
    npm publish
