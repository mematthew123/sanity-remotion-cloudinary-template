import {NextRequest, NextResponse} from 'next/server'
import {cloudinary, cloudinaryErrorResponse, corsHeaders, optionsResponse} from '../shared'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const folderPath = req.nextUrl.searchParams.get('path') || ''

    const result = folderPath
      ? await cloudinary.api.sub_folders(folderPath)
      : await cloudinary.api.root_folders()

    return NextResponse.json(
      {
        folders: result.folders.map((f: {name: string; path: string}) => ({
          name: f.name,
          path: f.path,
        })),
      },
      {headers: corsHeaders},
    )
  } catch (error) {
    return cloudinaryErrorResponse('folders', error, 'Folder fetch failed')
  }
}

export async function OPTIONS() {
  return optionsResponse()
}
