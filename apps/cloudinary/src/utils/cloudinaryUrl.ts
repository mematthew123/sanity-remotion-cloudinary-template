import {CLOUD_NAME} from '../constants'
import type {TransformPreset} from '../types'

export function buildTransformUrl(
  publicId: string,
  resourceType: string,
  transformation: {width?: number; height?: number; crop?: string; gravity?: string},
): string {
  const parts: string[] = []
  if (transformation.crop) parts.push(`c_${transformation.crop}`)
  if (transformation.width) parts.push(`w_${transformation.width}`)
  if (transformation.height) parts.push(`h_${transformation.height}`)
  if (transformation.gravity) parts.push(`g_${transformation.gravity}`)

  const transformStr = parts.join(',')
  return `https://res.cloudinary.com/${CLOUD_NAME}/${resourceType}/upload/${transformStr}/${publicId}`
}

export function buildPresetUrl(
  publicId: string,
  resourceType: string,
  preset: TransformPreset,
): string {
  return buildTransformUrl(publicId, resourceType, {
    width: preset.width,
    height: preset.height,
    crop: preset.crop,
    gravity: preset.gravity,
  })
}

export function buildThumbnailUrl(
  publicId: string,
  resourceType: string,
  width: number = 200,
): string {
  if (resourceType === 'video') {
    return `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/c_fill,w_${width},h_${Math.round(width * 0.75)},so_0/${publicId}.jpg`
  }
  return `https://res.cloudinary.com/${CLOUD_NAME}/${resourceType}/upload/c_fill,w_${width},h_${width}/${publicId}`
}

export function buildVideoPosterUrl(publicId: string): string {
  return `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/so_0/${publicId}.jpg`
}
