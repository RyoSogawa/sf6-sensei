// Shared UI strings for the site chrome (header / footer / copy button / language switcher).
// Page body prose lives inline in each locale's page file, not here.

export const languages = {
  en: 'English',
  ja: '日本語',
} as const

export type Lang = keyof typeof languages

export const defaultLang: Lang = 'ja'

export const ui = {
  en: {
    'copy.copied': 'Copied!',
    'copy.copy': 'Copy',
    'footer.tagline': 'SF6 Sensei — unofficial SF6 frame data MCP server',
    'lang.switch': '日本語',
    'lang.switchLabel': 'View this page in Japanese',
    'nav.github': 'GitHub',
    'nav.licenses': 'Rights & License',
    'nav.terms': 'Terms',
  },
  ja: {
    'copy.copied': 'コピーしました',
    'copy.copy': 'コピー',
    'footer.tagline': 'SF6 Sensei — 非公式 SF6 フレームデータ MCP サーバー',
    'lang.switch': 'English',
    'lang.switchLabel': 'このページを英語で表示',
    'nav.github': 'GitHub',
    'nav.licenses': '権利・ライセンス',
    'nav.terms': '利用規約',
  },
} as const
