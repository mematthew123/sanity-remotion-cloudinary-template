export {
  ArticleVideoPropsSchema,
  VideoCopySchema,
  COLORS,
  type ArticleVideoProps,
  type VideoCopy,
} from './types'

export {fonts, borderBrutal, shadowBrutal, headline, label, accent, body} from './styles'

export {loadedFonts} from './fonts'

export {ArticlePromo} from './compositions/ArticlePromo'
export {ArticleTeaser} from './compositions/ArticleTeaser'

export {
  COMPOSITIONS,
  getComposition,
  findComposition,
  compositionsForSource,
  VARIANTS,
  variantUrl,
  eagerTransformsFor,
  variantsForComposition,
  snapshotVariants,
  type CompositionId,
  type CompositionMeta,
  type SourceType,
  type VariantId,
  type VariantDef,
  type VariantSurface,
  type VariantFormat,
  type VariantSnapshot,
} from './registry'

export {COMPOSITION_COMPONENTS, getComponent} from './registry-components'
