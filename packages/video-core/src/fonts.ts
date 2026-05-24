import {loadFont as loadJetBrainsMono} from '@remotion/google-fonts/JetBrainsMono'
import {loadFont as loadInstrumentSerif} from '@remotion/google-fonts/InstrumentSerif'
import {loadFont as loadInter} from '@remotion/google-fonts/Inter'

const {fontFamily: monoFamily} = loadJetBrainsMono('normal', {
  weights: ['400', '700', '800'],
})

const {fontFamily: serifFamily} = loadInstrumentSerif('italic', {
  weights: ['400'],
})

const {fontFamily: bodyFamily} = loadInter('normal', {
  weights: ['400'],
})

export const loadedFonts = {
  mono: monoFamily,
  serif: serifFamily,
  body: bodyFamily,
} as const
