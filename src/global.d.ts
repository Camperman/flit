import type { GlideApi } from './shared/types'

declare global {
  interface Window {
    glide: GlideApi
  }
}

export {}
