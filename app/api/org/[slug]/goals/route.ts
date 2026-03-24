import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { authenticateOrg } from '@/lib/auth'

// PUT: upsert goals for all members of this org
export async function PUT(req: NextRequest, { params }: { params: { slug: string } }) {
  const auth = await authenticateOrg(req, params.slug)
  if (!auth.ok) return auth.response

  // Get all valid member IDs for this org
  const { data: orgMembers } = await getServiceSupabase()
    .from('li_members')
    .select('id')
    .eq('org_id', auth.org.id)
  const validIds = new Set((orgMembers ?? []).map(m => m.id))

  const goals: Record<string, {
    monthlyPosts: number
    monthlyImpressions: number
    monthlyFollowers: number
    monthlyIcpSignals: number
  }> = await req.json()

  // Reject any member IDs that don't belong to this org
  const rows = Object.entries(goals)
    .filter(([memberId]) => validIds.has(memberId))
    .map(([memberId, g]) => ({
      member_id: memberId,
      monthly_posts: g.monthlyPosts,
      monthly_impressions: g.monthlyImpressions,
      monthly_followers: g.monthlyFollowers,
      monthly_icp_signals: g.monthlyIcpSignals,
    }))

  if (rows.length > 0) {
    await getServiceSupabase().from('li_goals').upsert(rows, { onConflict: 'member_id' })
  }

  return NextResponse.json({ ok: true })
}
