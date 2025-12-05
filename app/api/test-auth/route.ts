import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'

export async function GET() {
  try {
    // Test if service role key works
    const supabase = getSupabaseServer()
    
    // Try to query the database
    const { data, error } = await supabase
      .from('deliveries')
      .select('count')
      .limit(1)
    
    if (error) {
      return NextResponse.json({
        success: false,
        message: 'Service role key not working',
        error: error.message
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      message: 'Service role key is working correctly! ✅',
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: 'Error testing service role key',
      error: error.message
    }, { status: 500 })
  }
}