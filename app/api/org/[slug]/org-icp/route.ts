import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { authenticateOrg } from '@/lib/auth'

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const auth = await authenticateOrg(req, params.slug)
  if (!auth.ok) return auth.response
  const org = auth.org

  const { signals } = await req.json()

  const { error: delErr } = await getServiceSupabase().from('li_org_icp_signals').delete().eq('org_id', org.id)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  if (signals && signals.length > 0) {
    const rows = signals.map((s: {
      date: string; name?: string; company?: string; title?: string
      action?: string; source?: string; isIcp?: boolean
    }) => ({
      org_id: org.id,
      date: s.date,
      name: s.name ?? null,
      company: s.company ?? null,
      title: s.title ?? null,
      action: s.action ?? '',
      source: s.source ?? null,
      is_icp: s.isIcp ?? false,
    }))
    const { error: insErr } = await getServiceSupabase().from('li_org_icp_signals').insert(rows)
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, count: signals?.length ?? 0 })
}

export async function DELETE(req: NextRequest, { params }: { params: { slug: string } }) {
  const auth = await authenticateOrg(req, params.slug)
  if (!auth.ok) return auth.response

  await getServiceSupabase().from('li_org_icp_signals').delete().eq('org_id', auth.org.id)
  return NextResponse.json({ ok: true })
}
