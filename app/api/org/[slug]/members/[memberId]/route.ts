import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { authenticateOrg, verifyMemberBelongsToOrg } from '@/lib/auth'
import { SupabaseClient } from '@supabase/supabase-js'

type Ctx = { params: { slug: string; memberId: string } }

// Safe replace: backup → delete → insert → restore on failure
async function safeReplace(
  sb: SupabaseClient,
  table: string,
  fkColumn: string,
  fkValue: string,
  newRows: Record<string, unknown>[],
  mapper: (row: Record<string, unknown>) => Record<string, unknown>,
) {
  const { data: backup, error: fetchErr } = await sb.from(table).select('*').eq(fkColumn, fkValue)
  if (fetchErr) throw new Error(`Failed to read existing data: ${fetchErr.message}`)

  const { error: delErr } = await sb.from(table).delete().eq(fkColumn, fkValue)
  if (delErr) throw new Error(`Failed to clear old data: ${delErr.message}`)

  if (newRows.length > 0) {
    const mapped = newRows.map(mapper)
    const { error: insErr } = await sb.from(table).insert(mapped)
    if (insErr) {
      // Restore backup on failure
      if (backup && backup.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const cleaned = backup.map(({ id, created_at, ...rest }) => rest)
        await sb.from(table).insert(cleaned)
      }
      throw new Error(`Failed to save new data (previous data restored): ${insErr.message}`)
    }
  }
}

// PATCH: update name/role and/or replace posts/followers/icp
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await authenticateOrg(req, params.slug)
  if (!auth.ok) return auth.response

  const { memberId } = params
  const belongs = await verifyMemberBelongsToOrg(memberId, auth.org.id)
  if (!belongs) return NextResponse.json({ error: 'Member not found in this org' }, { status: 403 })

  const body = await req.json()
  const sb = getServiceSupabase()

  try {
    if (body.name !== undefined || body.role !== undefined) {
      const patch: Record<string, string> = {}
      if (body.name !== undefined) patch.name = body.name
      if (body.role !== undefined) patch.role = body.role
      const { error } = await sb.from('li_members').update(patch).eq('id', memberId)
      if (error) throw error
    }

    if (body.posts !== undefined) {
      await safeReplace(sb, 'li_posts', 'member_id', memberId, body.posts, (p) => ({
        member_id: memberId,
        date: p.date, url: p.url ?? null,
        impressions: p.impressions ?? 0, clicks: p.clicks ?? 0,
        likes: p.likes ?? 0, comments: p.comments ?? 0,
        shares: p.shares ?? 0, follows: p.follows ?? 0,
        engagements: p.engagements ?? 0, engagement_rate: p.engagementRate ?? 0,
      }))
    }

    if (body.followerHistory !== undefined) {
      await safeReplace(sb, 'li_follower_history', 'member_id', memberId, body.followerHistory, (f) => ({
        member_id: memberId, date: (f as { date: string }).date, new_followers: (f as { newFollowers: number }).newFollowers,
      }))
    }

    if (body.icpSignals !== undefined) {
      await safeReplace(sb, 'li_icp_signals', 'member_id', memberId, body.icpSignals, (s) => ({
        member_id: memberId,
        date: s.date, name: s.name ?? null, company: s.company ?? null,
        title: s.title ?? null, action: s.action ?? '', source: s.source ?? null,
        is_icp: s.isIcp ?? false,
      }))
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message || 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// DELETE: remove member (cascades posts/followers/icp/goals)
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = await authenticateOrg(req, params.slug)
  if (!auth.ok) return auth.response

  const { memberId } = params
  const belongs = await verifyMemberBelongsToOrg(memberId, auth.org.id)
  if (!belongs) return NextResponse.json({ error: 'Member not found in this org' }, { status: 403 })

  await getServiceSupabase().from('li_members').delete().eq('id', memberId)
  return NextResponse.json({ ok: true })
}
