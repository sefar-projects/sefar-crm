import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VALID_ROLES = ['admin', 'visa_editor', 'notes_only'] as const

type Role = (typeof VALID_ROLES)[number]

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const supabaseServiceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return new Response(JSON.stringify({ error: 'Missing Supabase environment variables.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization header.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  })

  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser()

  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: profile, error: profileError } = await callerClient
    .from('profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError || !profile || profile.role !== 'admin' || !profile.is_active) {
    return new Response(JSON.stringify({ error: 'Admin access required.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const body = await req.json().catch(() => null)
  const fullName = typeof body?.full_name === 'string' ? body.full_name.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const role = VALID_ROLES.includes(body?.role) ? (body.role as Role) : 'notes_only'

  if (!fullName || !email || !password) {
    return new Response(JSON.stringify({ error: 'Full name, email, and password are required.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey)

  const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    data: {
      full_name: fullName,
      role,
    },
  })

  if (createError) {
    return new Response(JSON.stringify({ error: createError.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const createdUserId = createData.user?.id
  if (!createdUserId) {
    return new Response(JSON.stringify({ error: 'User created but user id was not returned.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { error: profileUpsertError } = await adminClient.from('profiles').upsert(
    {
      user_id: createdUserId,
      full_name: fullName,
      role,
      is_active: true,
    },
    { onConflict: 'user_id' },
  )

  if (profileUpsertError) {
    return new Response(JSON.stringify({ error: profileUpsertError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(
    JSON.stringify({
      ok: true,
      user_id: createdUserId,
      full_name: fullName,
      email,
      role,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  )
})