/**
 * Curated quick-add catalog for the Add App dialog: 100 popular web apps.
 * `domain` drives the icon (Google favicon service); `url` is what the
 * shortcut opens. Once the app is opened, Flit's own favicon capture
 * (page-favicon-updated) replaces the catalog icon on the rail.
 */
export interface CatalogApp {
  label: string
  url: string
  domain: string
}

export interface CatalogCategory {
  name: string
  apps: CatalogApp[]
}

export const APP_CATALOG: CatalogCategory[] = [
  {
    name: 'Email',
    apps: [
      { label: 'Gmail', url: 'https://mail.google.com', domain: 'gmail.com' },
      { label: 'Outlook', url: 'https://outlook.live.com/mail/', domain: 'outlook.com' },
      { label: 'Proton Mail', url: 'https://mail.proton.me', domain: 'proton.me' },
      { label: 'Fastmail', url: 'https://app.fastmail.com', domain: 'fastmail.com' },
      { label: 'Yahoo Mail', url: 'https://mail.yahoo.com', domain: 'mail.yahoo.com' },
      { label: 'iCloud Mail', url: 'https://www.icloud.com/mail', domain: 'icloud.com' },
      { label: 'HEY', url: 'https://app.hey.com', domain: 'hey.com' },
      { label: 'Zoho Mail', url: 'https://mail.zoho.com', domain: 'zoho.com' }
    ]
  },
  {
    name: 'Messaging & Calls',
    apps: [
      { label: 'Slack', url: 'https://app.slack.com/client', domain: 'slack.com' },
      { label: 'Discord', url: 'https://discord.com/app', domain: 'discord.com' },
      { label: 'WhatsApp', url: 'https://web.whatsapp.com', domain: 'whatsapp.com' },
      { label: 'Telegram', url: 'https://web.telegram.org', domain: 'telegram.org' },
      { label: 'Messenger', url: 'https://www.messenger.com', domain: 'messenger.com' },
      { label: 'Microsoft Teams', url: 'https://teams.microsoft.com', domain: 'teams.microsoft.com' },
      { label: 'Google Chat', url: 'https://chat.google.com', domain: 'chat.google.com' },
      { label: 'Zoom', url: 'https://app.zoom.us', domain: 'zoom.us' },
      { label: 'Google Meet', url: 'https://meet.google.com', domain: 'meet.google.com' }
    ]
  },
  {
    name: 'Google',
    apps: [
      { label: 'Calendar', url: 'https://calendar.google.com', domain: 'calendar.google.com' },
      { label: 'Drive', url: 'https://drive.google.com', domain: 'drive.google.com' },
      { label: 'Docs', url: 'https://docs.google.com', domain: 'docs.google.com' },
      { label: 'Sheets', url: 'https://sheets.google.com', domain: 'sheets.google.com' },
      { label: 'Slides', url: 'https://slides.google.com', domain: 'slides.google.com' },
      { label: 'Photos', url: 'https://photos.google.com', domain: 'photos.google.com' },
      { label: 'Maps', url: 'https://maps.google.com', domain: 'maps.google.com' },
      { label: 'Keep', url: 'https://keep.google.com', domain: 'keep.google.com' },
      { label: 'Contacts', url: 'https://contacts.google.com', domain: 'contacts.google.com' },
      { label: 'NotebookLM', url: 'https://notebooklm.google.com', domain: 'notebooklm.google.com' }
    ]
  },
  {
    name: 'AI',
    apps: [
      { label: 'Claude', url: 'https://claude.ai', domain: 'claude.ai' },
      { label: 'ChatGPT', url: 'https://chatgpt.com', domain: 'chatgpt.com' },
      { label: 'Gemini', url: 'https://gemini.google.com', domain: 'gemini.google.com' },
      { label: 'Perplexity', url: 'https://www.perplexity.ai', domain: 'perplexity.ai' },
      { label: 'Copilot', url: 'https://copilot.microsoft.com', domain: 'copilot.microsoft.com' },
      { label: 'Grok', url: 'https://grok.com', domain: 'grok.com' }
    ]
  },
  {
    name: 'Productivity',
    apps: [
      { label: 'Notion', url: 'https://www.notion.so', domain: 'notion.so' },
      { label: 'Asana', url: 'https://app.asana.com', domain: 'asana.com' },
      { label: 'Trello', url: 'https://trello.com', domain: 'trello.com' },
      { label: 'Todoist', url: 'https://app.todoist.com', domain: 'todoist.com' },
      { label: 'Linear', url: 'https://linear.app', domain: 'linear.app' },
      { label: 'Jira', url: 'https://home.atlassian.com', domain: 'atlassian.com' },
      { label: 'Monday', url: 'https://monday.com', domain: 'monday.com' },
      { label: 'ClickUp', url: 'https://app.clickup.com', domain: 'clickup.com' },
      { label: 'Airtable', url: 'https://airtable.com', domain: 'airtable.com' },
      { label: 'Calendly', url: 'https://calendly.com', domain: 'calendly.com' }
    ]
  },
  {
    name: 'Microsoft',
    apps: [
      { label: 'Microsoft 365', url: 'https://www.office.com', domain: 'office.com' },
      { label: 'OneDrive', url: 'https://onedrive.live.com', domain: 'onedrive.live.com' },
      { label: 'OneNote', url: 'https://www.onenote.com', domain: 'onenote.com' },
      { label: 'Microsoft To Do', url: 'https://to-do.office.com', domain: 'to-do.office.com' }
    ]
  },
  {
    name: 'Developer',
    apps: [
      { label: 'GitHub', url: 'https://github.com', domain: 'github.com' },
      { label: 'GitLab', url: 'https://gitlab.com', domain: 'gitlab.com' },
      { label: 'Bitbucket', url: 'https://bitbucket.org', domain: 'bitbucket.org' },
      { label: 'Stack Overflow', url: 'https://stackoverflow.com', domain: 'stackoverflow.com' },
      { label: 'Vercel', url: 'https://vercel.com', domain: 'vercel.com' },
      { label: 'Netlify', url: 'https://app.netlify.com', domain: 'netlify.com' },
      { label: 'Cloudflare', url: 'https://dash.cloudflare.com', domain: 'cloudflare.com' },
      { label: 'AWS', url: 'https://console.aws.amazon.com', domain: 'aws.amazon.com' },
      { label: 'Google Cloud', url: 'https://console.cloud.google.com', domain: 'cloud.google.com' },
      { label: 'Azure', url: 'https://portal.azure.com', domain: 'portal.azure.com' },
      { label: 'Replit', url: 'https://replit.com', domain: 'replit.com' },
      { label: 'CodePen', url: 'https://codepen.io', domain: 'codepen.io' }
    ]
  },
  {
    name: 'Design',
    apps: [
      { label: 'Figma', url: 'https://www.figma.com', domain: 'figma.com' },
      { label: 'Canva', url: 'https://www.canva.com', domain: 'canva.com' },
      { label: 'Miro', url: 'https://miro.com', domain: 'miro.com' },
      { label: 'Adobe Express', url: 'https://express.adobe.com', domain: 'adobe.com' },
      { label: 'Framer', url: 'https://www.framer.com', domain: 'framer.com' }
    ]
  },
  {
    name: 'Social',
    apps: [
      { label: 'LinkedIn', url: 'https://www.linkedin.com', domain: 'linkedin.com' },
      { label: 'X', url: 'https://x.com', domain: 'x.com' },
      { label: 'Instagram', url: 'https://www.instagram.com', domain: 'instagram.com' },
      { label: 'Facebook', url: 'https://www.facebook.com', domain: 'facebook.com' },
      { label: 'Reddit', url: 'https://www.reddit.com', domain: 'reddit.com' },
      { label: 'TikTok', url: 'https://www.tiktok.com', domain: 'tiktok.com' },
      { label: 'Threads', url: 'https://www.threads.net', domain: 'threads.net' },
      { label: 'Bluesky', url: 'https://bsky.app', domain: 'bsky.app' },
      { label: 'Pinterest', url: 'https://www.pinterest.com', domain: 'pinterest.com' },
      { label: 'Twitch', url: 'https://www.twitch.tv', domain: 'twitch.tv' }
    ]
  },
  {
    name: 'Media',
    apps: [
      { label: 'YouTube', url: 'https://www.youtube.com', domain: 'youtube.com' },
      { label: 'YouTube Music', url: 'https://music.youtube.com', domain: 'music.youtube.com' },
      { label: 'Spotify', url: 'https://open.spotify.com', domain: 'spotify.com' },
      { label: 'Apple Music', url: 'https://music.apple.com', domain: 'music.apple.com' },
      { label: 'Netflix', url: 'https://www.netflix.com', domain: 'netflix.com' },
      { label: 'SoundCloud', url: 'https://soundcloud.com', domain: 'soundcloud.com' }
    ]
  },
  {
    name: 'Files & Notes',
    apps: [
      { label: 'Dropbox', url: 'https://www.dropbox.com', domain: 'dropbox.com' },
      { label: 'Box', url: 'https://app.box.com', domain: 'box.com' },
      { label: 'Evernote', url: 'https://www.evernote.com', domain: 'evernote.com' },
      { label: 'iCloud', url: 'https://www.icloud.com', domain: 'icloud.com' }
    ]
  },
  {
    name: 'Business',
    apps: [
      { label: 'Salesforce', url: 'https://login.salesforce.com', domain: 'salesforce.com' },
      { label: 'HubSpot', url: 'https://app.hubspot.com', domain: 'hubspot.com' },
      { label: 'Zendesk', url: 'https://www.zendesk.com/login/', domain: 'zendesk.com' },
      { label: 'Intercom', url: 'https://app.intercom.com', domain: 'intercom.com' },
      { label: 'Stripe', url: 'https://dashboard.stripe.com', domain: 'stripe.com' },
      { label: 'PayPal', url: 'https://www.paypal.com', domain: 'paypal.com' },
      { label: 'QuickBooks', url: 'https://qbo.intuit.com', domain: 'quickbooks.intuit.com' },
      { label: 'Xero', url: 'https://go.xero.com', domain: 'xero.com' },
      { label: 'Shopify', url: 'https://admin.shopify.com', domain: 'shopify.com' },
      { label: 'Mailchimp', url: 'https://admin.mailchimp.com', domain: 'mailchimp.com' }
    ]
  },
  {
    name: 'News & Reading',
    apps: [
      { label: 'Feedly', url: 'https://feedly.com', domain: 'feedly.com' },
      { label: 'Google News', url: 'https://news.google.com', domain: 'news.google.com' },
      { label: 'Substack', url: 'https://substack.com', domain: 'substack.com' },
      { label: 'Medium', url: 'https://medium.com', domain: 'medium.com' }
    ]
  },
  {
    name: 'Shopping',
    apps: [
      { label: 'Amazon', url: 'https://www.amazon.com', domain: 'amazon.com' },
      { label: 'Etsy', url: 'https://www.etsy.com', domain: 'etsy.com' }
    ]
  }
]

/** Icon URL for a catalog entry (Google's favicon service, 64px). */
export function catalogIconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`
}
