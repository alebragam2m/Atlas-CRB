import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://rypmiipqzpbkpujgewgb.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5cG1paXBxenBia3B1amdld2diIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNzc0MzgsImV4cCI6MjA5MTg1MzQzOH0.-TsKANO2XzxGDtJV2YwkPjkhE-dYxgnst0Js90rOTcI'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)