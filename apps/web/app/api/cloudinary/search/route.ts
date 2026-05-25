import {NextRequest, NextResponse} from 'next/server'
import {cloudinary, cloudinaryErrorResponse, corsHeaders, optionsResponse} from '../shared'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams
    const query = params.get('query') || ''
    const resourceType = params.get('resource_type') || ''
    const maxResults = parseInt(params.get('max_results') || '30', 10)
    const nextCursor = params.get('next_cursor') || undefined
    const sortBy = params.get('sort_by') || 'created_at'
    const direction = (params.get('direction') || 'desc') as 'asc' | 'desc'
    const folder = params.get('folder') || ''

    const parts: string[] = []
    if (resourceType) parts.push(`resource_type:${resourceType}`)
    if (folder) parts.push(`folder:${folder}/*`)
    if (query) parts.push(`(${query})`)
    const expression = parts.join(' AND ')

    const search = cloudinary.search
      .sort_by(sortBy, direction)
      .max_results(maxResults)
      .with_field('tags')
      .with_field('context')

    if (expression) {
      search.expression(expression)
    }

    if (nextCursor) {
      search.next_cursor(nextCursor)
    }

    const result = await search.execute()

    return NextResponse.json(
      {
        resources: result.resources,
        next_cursor: result.next_cursor,
        total_count: result.total_count,
      },
      {headers: corsHeaders},
    )
  } catch (error) {
    return cloudinaryErrorResponse('search', error, 'Search failed')
  }
}

export async function OPTIONS() {
  return optionsResponse()
}
