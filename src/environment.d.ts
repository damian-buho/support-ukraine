// SPDX-FileCopyrightText: 2026 Damián Búho <damian.buho@proton.me>
//
// SPDX-License-Identifier: MIT

declare module '*.yaml' {
  const content: Record<string, unknown> | Record<string, unknown>[]
  export default content
}

declare module '*.scss' {
  const content: string
  export default content
}
