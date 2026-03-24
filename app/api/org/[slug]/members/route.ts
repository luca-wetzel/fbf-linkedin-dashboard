import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { authenticateOrg } from '@/lib/auth'

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const auth = await authenticateOrg(req, params.slug)
  if (!auth.ok) return auth.response
  const org = auth.org

  const body = await req.json()
  const { name, role, posts = [], followerHistory = [], icpSignals = [] } = body

  const { data: member, error } = await getServiceSupabase()
    .from('li_members')
    .insert({ org_id: org.id, name, role: role ?? '' })
    .select()
    .single()

  if (error || !member) return NextResponse.json({ error: error?.message }, { status: 500 })

  try {
    const { error: goalsErr } = await getServiceSupabase().from('li_goals').insert({
      member_id: member.id,
      monthly_posts: 8,
      monthly_impressions: 10000,
      monthly_followers: 100,
      monthly_icp_signals: 20,
    })
    if (goalsErr) throw goalsErr

    if (posts.length > 0) {
      const { error: postsErr } = await getServiceSupabase().from('li_posts').insert(
        posts.map((p: Record<string, unknown>) => ({ member_id: member.id, ...flatPost(p) }))
      )
      if (postsErr) throw postsErr
    }
    if (followerHistory.length > 0) {
      const { error: fhErr } = await getServiceSupabase().from('li_follower_history').insert(
        followerHistory.map((f: { date: string; newFollowers: number }) => ({
          member_id: member.id, date: f.date, new_followers: f.newFollowers,
        }))
      )
      if (fhErr) throw fhErr
    }
    if (icpSignals.length > 0) {
      const { error: icpErr } = await getServiceSupabase().from('li_icp_signals').insert(
        icpSignals.map((s: Record<string, unknown>) => ({ member_id: member.id, ...flatSignal(s) }))
      )
      if (icpErr) throw icpErr
    }
  } catch (insertErr) {
    // Cleanup: delete the partially created member (cascades to goals/posts/etc)
    await getServiceSupabase().from('li_members').delete().eq('id', member.id)
    return NextResponse.json({ error: `Failed to create member data: ${(insertErr as Error).message}` }, { status: 500 })
  }

  return NextResponse.json({ id: member.id, addedAt: member.added_at })
}

function flatPost(p: Record<string, unknown>) {
  return {
    date: p.date, url: p.url ?? null,
    impressions: p.impressions ?? 0, clicks: p.clicks ?? 0,
    likes: p.likes ?? 0, comments: p.comments ?? 0,
    shares: p.shares ?? 0, follows: p.follows ?? 0,
    engagements: p.engagements ?? 0, engagement_rate: p.engagementRate ?? 0,
  }
}

function flatSignal(s: Record<string, unknown>) {
  return {
    date: s.date, name: s.name ?? null, company: s.company ?? null,
    title: s.title ?? null, action: s.action ?? '', source: s.source ?? null,
    is_icp: s.isIcp ?? false,
  }
}
