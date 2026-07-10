/**
 * Curated quick-install extensions for the puzzle-piece menu's catalog.
 * IDs verified against chromewebstore.google.com (each redirects to the slug
 * shown in the comment). Installs go through electron-chrome-web-store's
 * installExtension — the same path as the store's own "Add to Chrome" button.
 * Not every Chrome extension works in Flit (native messaging is unavailable);
 * this list sticks to ones known to function or degrade gracefully.
 */
export interface CatalogExtension {
  id: string
  name: string
  blurb: string
}

export const EXTENSION_CATALOG: CatalogExtension[] = [
  // ublock-origin-lite
  { id: 'ddkjiahejlhfcafbddmgiahcphecmpfh', name: 'uBlock Origin Lite', blurb: 'Ad + tracker blocking (MV3)' },
  // dark-reader
  { id: 'eimadpbcbfnmbkopoojfekhnkhdbieeh', name: 'Dark Reader', blurb: 'Dark mode for every site' },
  // bitwarden-password-manage
  { id: 'nngceckbapebfimnlniiiahkandclblb', name: 'Bitwarden', blurb: 'Password manager with in-page autofill' },
  // 1password-password-mana
  { id: 'aeblfdkhhhdcdjpifhhbdiojplfjncoa', name: '1Password', blurb: 'Password manager (no biometric unlock in Flit)' },
  // grammarly-ai-writing-assi
  { id: 'kbfnbcaeplbcioakkpcpgfkobkghlhen', name: 'Grammarly', blurb: 'Writing suggestions everywhere' },
  // privacy-badger
  { id: 'pkehgijcmpdhfbdbbnkijodmdjhbjlgp', name: 'Privacy Badger', blurb: 'Learns to block invisible trackers' },
  // honey-automated-coupons-r
  { id: 'bmnlcjabgnpnenekpadlanbbkooimhnj', name: 'Honey', blurb: 'Coupon codes at checkout' },
  // momentum
  { id: 'laookkfknpbbblfpciffpaejjkokdgca', name: 'Momentum', blurb: 'New-tab dashboard with focus + todos' },
  // notion-web-clipper
  { id: 'knheggckgoiihginacbkhaalnibhilkk', name: 'Notion Web Clipper', blurb: 'Save pages to Notion' },
  // loom-screen-recorder-sc
  { id: 'liecbddmkiiihnedobmlmillhodjkdmb', name: 'Loom', blurb: 'Screen recording + instant share links' },
  // json-formatter
  { id: 'bcjindcccaagfpapjjmafapmmgkkhgoa', name: 'JSON Formatter', blurb: 'Pretty-print JSON responses' },
  // react-developer-tools
  { id: 'fmkadmapgofadopljbjfkapdkoienihi', name: 'React Developer Tools', blurb: 'Inspect React component trees' },
  // vuejs-devtools
  { id: 'nhdogjmejiglipccpnnnanhbledajbpd', name: 'Vue.js devtools', blurb: 'Inspect Vue apps' },
  // wappalyzer-technology-pro
  { id: 'gppongmhjkpfnbhagpmjfkannfbllamg', name: 'Wappalyzer', blurb: 'Identify site tech stacks' }
]

export function storeUrl(id: string): string {
  return `https://chromewebstore.google.com/detail/${id}`
}
