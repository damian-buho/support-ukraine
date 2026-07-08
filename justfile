# SPDX-FileCopyrightText: 2026 Damián Búho <damian.buho@proton.me>
#
# SPDX-License-Identifier: MIT

set quiet

[private]
default:
    @just --choose || just --list

build:
    npm run build

test:
    npm test

test-verbose:
    npm run test:verbose

coverage:
    npm run test:coverage

lint:
    npm run lint

fix:
    npm run fix

format:
    npm run format

format-check:
    npm run format:check

audit:
    npm audit

pipeline: format lint test build

publish:
    npm publish
