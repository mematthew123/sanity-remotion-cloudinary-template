import { draftMode } from 'next/headers';
import { NextResponse } from 'next/server';

// Exits draft mode and returns home (linked from the <DisableDraftMode> banner).
export async function GET(request: Request) {
  (await draftMode()).disable();
  return NextResponse.redirect(new URL('/', request.url));
}
