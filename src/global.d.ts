import type { GlideApi } from './shared/types'

declare global {
  interface Window {
    glide: GlideApi
  }

  namespace JSX {
    interface IntrinsicElements {
      /** Extension toolbar (electron-chrome-extensions custom element). */
      'browser-action-list': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        partition?: string
        alignment?: string
        /** React passes props to custom elements as literal attributes —
         *  use `class`, not `className` (which becomes `classname="…"`). */
        class?: string
      }
    }
  }
}

export {}
