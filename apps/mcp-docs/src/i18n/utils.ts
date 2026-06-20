import { defaultLang, type Lang, ui } from './ui'

// Detect the active locale from the URL: anything under `/en/...` is English,
// everything else is the default Japanese locale.
export function getLangFromUrl(url: URL): Lang {
  const [, seg] = url.pathname.split('/')
  return seg === 'en' ? 'en' : 'ja'
}

// Returns a `t(key)` helper bound to the given locale, falling back to the default.
export function useTranslations(lang: Lang) {
  return function t(key: keyof (typeof ui)[typeof defaultLang]): string {
    return ui[lang][key] ?? ui[defaultLang][key]
  }
}

// Build an absolute path for `path` (locale-agnostic, e.g. '', 'terms', 'licenses')
// in the given locale. Japanese stays at the root; English is prefixed with `/en`.
export function localizePath(path: string, lang: Lang): string {
  const clean = path.replace(/^\/+|\/+$/g, '')
  const prefix = lang === 'en' ? '/en' : ''
  return clean ? `${prefix}/${clean}` : `${prefix}/`
}

// Given the current URL, return the equivalent path in `lang` (used by the switcher).
export function alternatePath(url: URL, lang: Lang): string {
  const segs = url.pathname.split('/').filter(Boolean)
  if (segs[0] === 'en') segs.shift()
  return localizePath(segs.join('/'), lang)
}
