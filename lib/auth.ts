import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from './supabase'

type OrgRow = { id: string; slug: string; name: string; api_key: string }

type AuthResult =
  | { ok: true; org: OrgRow }
  | { ok: false; response: NextResponse }

export async function authenticateOrg(req: NextRequest, slug: string): Promise<AuthResult> {
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) {
    return { ok: false, response: NextResponse.json({ error: 'Missing API key' }, { status: 401 }) }
  }

  const { data: org } = await getServiceSupabase()
    .from('li_organizations')
    .select('id, slug, name, api_key')
    .eq('slug', slug)
    .single()

  if (!org) {
    return { ok: false, response: NextResponse.json({ error: 'Org not found' }, { status: 404 }) }
  }

  if (org.api_key !== apiKey) {
    return { ok: false, response: NextResponse.json({ error: 'Invalid API key' }, { status: 401 }) }
  }

  return { ok: true, org }
}

export async function verifyMemberBelongsToOrg(memberId: string, orgId: string): Promise<boolean> {
  const { data } = await getServiceSupabase()
    .from('li_members')
    .select('id')
    .eq('id', memberId)
    .eq('org_id', orgId)
    .single()
  return !!data
}
