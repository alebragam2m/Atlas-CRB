import { supabase } from '../supabase.js'

export async function checkSession(redirectTo = 'index.html') {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    window.location.href = redirectTo
    return null
  }
  return session
}

export async function logout() {
  await supabase.auth.signOut()
  window.location.href = 'index.html'
}