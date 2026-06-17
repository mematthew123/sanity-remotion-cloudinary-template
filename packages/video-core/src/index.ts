export {
  ArticleNarratedChunkSchema,
  ArticleNarratedPropsSchema,
  ArticleVideoPropsSchema,
  VideoCopySchema,
  COLORS,
  type ArticleNarratedChunk,
  type ArticleNarratedProps,
  type ArticleVideoProps,
  type VideoCopy,
} from './types'

export {loadedFonts} from './fonts'

export {ArticlePromo} from './compositions/ArticlePromo'
export {ArticleTeaser} from './compositions/ArticleTeaser'
export {ArticleNarrated} from './compositions/ArticleNarrated'

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
