import {NextRequest, NextResponse} from 'next/server'
import {cloudinary, cloudinaryErrorResponse, corsHeaders, optionsResponse} from '../shared'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {public_id, resource_type = 'image', transformation} = body

    if (!public_id || !transformation) {
      return NextResponse.json(
        {error: 'Missing public_id or transformation'},
        {status: 400, headers: corsHeaders},
      )
    }

    const result = await cloudinary.uploader.explicit(public_id, {
      type: 'upload',
      resource_type,
      eager: [transformation],
      eager_async: false,
    })

    const eager = result.eager?.[0]

    return NextResponse.json(
      {
        url: eager?.url || result.url,
        secure_url: eager?.secure_url || result.secure_url,
        width: eager?.width,
        height: eager?.height,
        format: eager?.format,
      },
      {headers: corsHeaders},
    )
  } catch (error) {
    return cloudinaryErrorResponse('transform', error, 'Transform failed')
  }
}

export async function OPTIONS() {
  return optionsResponse()
}
