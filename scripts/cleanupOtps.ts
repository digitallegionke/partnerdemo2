import { createAnonClient } from '@/lib/supabase'

async function cleanup() {
  try {
    const anon = createAnonClient()
    const { data, error } = await anon.rpc('driver_otp_sweep_expired')

    if (error) {
      console.error('OTP cleanup error:', error)
      process.exit(1)
    }

    console.log('OTP cleanup completed, rows deleted:', data ?? 0)
    process.exit(0)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Unexpected cleanup error:', message)
    process.exit(1)
  }
}

cleanup()
