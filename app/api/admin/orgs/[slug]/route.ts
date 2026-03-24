import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'

function checkAdmin(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

export async function DELETE(req: NextRequest, { params }: { params: { slug: string } }) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await getServiceSupabase().from('li_organizations').delete().eq('slug', params.slug)
  return NextResponse.json({ ok: true })
}
