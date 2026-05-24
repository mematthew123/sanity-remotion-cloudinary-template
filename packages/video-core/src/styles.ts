import type {CSSProperties} from 'react'
import {COLORS} from './types'
import {loadedFonts} from './fonts'

export const fonts = {
  mono: loadedFonts.mono,
  serif: loadedFonts.serif,
  body: loadedFonts.body,
}

export const borderBrutal: CSSProperties = {
  border: `3px solid ${COLORS.foreground}`,
}

export const shadowBrutal: CSSProperties = {
  boxShadow: `4px 4px 0px ${COLORS.foreground}`,
}

export const headline = (size: number): CSSProperties => ({
  fontFamily: fonts.mono,
  fontWeight: 800,
  fontSize: size,
  textTransform: 'uppercase' as const,
  letterSpacing: '-0.02em',
  color: COLORS.foreground,
})

export const label = (size: number): CSSProperties => ({
  fontFamily: fonts.mono,
  fontWeight: 700,
  fontSize: size,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.1em',
  color: COLORS.foreground,
})

export const accent = (size: number): CSSProperties => ({
  fontFamily: fonts.serif,
  fontStyle: 'italic' as const,
  fontSize: size,
  color: COLORS.foreground,
})

export const body = (size: number): CSSProperties => ({
  fontFamily: fonts.body,
  fontWeight: 400,
  fontSize: size,
  color: COLORS.foreground,
})
