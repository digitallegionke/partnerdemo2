import { getSupabaseServer } from '@/lib/supabase-server';

async function cleanup() {
  try {
    const adminSupabase = await getSupabaseServer();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { error } = await adminSupabase
      .from('otp_verifications')
      .delete()
      .lt('created_at', oneHourAgo);

    if (error) {
      console.error('OTP cleanup error:', error);
      process.exit(1);
    }

    console.log('OTP cleanup completed');
    process.exit(0);
  } catch (err: any) {
    console.error('Unexpected cleanup error:', err.message || err);
    process.exit(1);
  }
}

cleanup();
