// SPDX-FileCopyrightText: 2026 Damián Búho <damian.buho@proton.me>
//
// SPDX-License-Identifier: MIT

import { readFileSync } from 'node:fs'
import type { PluginBuild } from 'esbuild'
import { compile } from 'sass'
import { load as loadYaml } from 'js-yaml'
import { defineConfig } from 'tsup'

const yamlPlugin = {
  name: 'yaml',
  setup(build: PluginBuild) {
    build.onLoad({ filter: /\.ya?ml$/, namespace: 'file' }, async (a: { path: string }) => {
      const text = readFileSync(a.path, 'utf8')
      const data = loadYaml(text)
      return {
        contents: `export default ${JSON.stringify(data)}`,
        loader: 'js'
      }
    })
  }
}

const scssPlugin = {
  name: 'scss',
  setup(build: PluginBuild) {
    build.onLoad({ filter: /\.scss$/, namespace: 'file' }, async (a: { path: string }) => {
      const result = compile(a.path, { style: 'compressed' })
      return {
        contents: `export default ${JSON.stringify(result.css)}`,
        loader: 'js'
      }
    })
  }
}

const plugins = [yamlPlugin, scssPlugin]

const isTestBuild = process.env.TEST_BUILD === '1'

export default defineConfig(
  isTestBuild
    ? {
        entry: ['tests/index.test.ts'],
        outDir: 'dist/test',
        clean: false,
        format: ['esm'] as const,
        dts: false,
        platform: 'node' as const,
        target: 'es2022' as const,
        removeNodeProtocol: false,
        esbuildPlugins: plugins
      }
    : {
        entry: ['src/index.ts'],
        outDir: 'dist',
        clean: true,
        // Minify the published bundle (esbuild's minifier). Locals mangle,
        // exports are preserved. No dropConsole: the isInConsole option
        // relies on console.info at runtime — see src/index.ts.
        minify: true,
        format: ['esm'] as const,
        dts: false,
        platform: 'browser' as const,
        target: 'es2022' as const,
        esbuildPlugins: plugins
      }
)
