import {loadFont as loadJetBrainsMono} from '@remotion/google-fonts/JetBrainsMono'
import {loadFont as loadInstrumentSerif} from '@remotion/google-fonts/InstrumentSerif'
import {loadFont as loadInter} from '@remotion/google-fonts/Inter'

const {fontFamily: monoFamily} = loadJetBrainsMono('normal', {
  weights: ['400', '700', '800'],
})

const {fontFamily: serifFamily} = loadInstrumentSerif('italic', {
  weights: ['400'],
})

// 700 is used by the narrated composition's titles — without it the browser
// synthesises a smeared faux-bold from the regular weight.
const {fontFamily: bodyFamily} = loadInter('normal', {
  weights: ['400', '700'],
})

export const loadedFonts = {
  mono: monoFamily,
  serif: serifFamily,
  body: bodyFamily,
} as const
