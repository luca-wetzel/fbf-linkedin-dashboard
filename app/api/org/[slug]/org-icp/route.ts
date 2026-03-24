import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

async function getOrg(slug: string) {
  const { data } = await getSupabase()
    .from('li_organizations')
    .select('id')
    .eq('slug', slug)
    .single()
  return data
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const org = await getOrg(params.slug)
  if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 })

  const { signals } = await req.json()

  await getSupabase().from('li_org_icp_signals').delete().eq('org_id', org.id)

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
    await getSupabase().from('li_org_icp_signals').insert(rows)
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { slug: string } }) {
  const org = await getOrg(params.slug)
  if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 })

  await getSupabase().from('li_org_icp_signals').delete().eq('org_id', org.id)
  return NextResponse.json({ ok: true })
}
