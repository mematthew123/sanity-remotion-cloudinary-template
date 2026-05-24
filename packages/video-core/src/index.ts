export {ArticleVideoPropsSchema, COLORS, type ArticleVideoProps} from './types'

export {fonts, borderBrutal, shadowBrutal, headline, label, accent, body} from './styles'

export {loadedFonts} from './fonts'

export {ArticlePromo} from './compositions/ArticlePromo'
export {ArticleTeaser} from './compositions/ArticleTeaser'

export {
  COMPOSITIONS,
  getComposition,
  findComposition,
  compositionsForSource,
  type CompositionId,
  type CompositionMeta,
  type SourceType,
} from './registry'

export {COMPOSITION_COMPONENTS, getComponent} from './registry-components'
