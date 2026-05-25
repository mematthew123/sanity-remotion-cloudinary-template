import {NextRequest, NextResponse} from 'next/server'
import {cloudinary, cloudinaryErrorResponse, corsHeaders, optionsResponse} from '../shared'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const publicId = req.nextUrl.searchParams.get('public_id')
    const resourceType = req.nextUrl.searchParams.get('resource_type') || 'image'

    if (!publicId) {
      return NextResponse.json(
        {error: 'Missing public_id parameter'},
        {status: 400, headers: corsHeaders},
      )
    }

    const result = await cloudinary.api.resource(publicId, {
      resource_type: resourceType,
      colors: true,
      image_metadata: true,
      faces: true,
    })

    return NextResponse.json(result, {headers: corsHeaders})
  } catch (error) {
    return cloudinaryErrorResponse('asset', error, 'Asset fetch failed')
  }
}

export async function OPTIONS() {
  return optionsResponse()
}
