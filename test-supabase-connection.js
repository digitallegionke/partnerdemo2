#!/usr/bin/env node

// Simple test script to verify Supabase connection
const https = require('https');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🧪 Testing Supabase Connection...\n');

if (!SUPABASE_KEY || SUPABASE_KEY === 'your_actual_anon_key_here') {
  console.error('❌ Missing or invalid SUPABASE_ANON_KEY in .env.local');
  console.log('📝 Please update .env.local with your real key from:');
  console.log('   https://supabase.com/dashboard/project/zolqvkpgiauqnjgujtvl/settings/api\n');
  process.exit(1);
}

// Test API call to drivers table
const url = `${SUPABASE_URL}/rest/v1/drivers?select=id,name&limit=1`;
const options = {
  method: 'GET',
  headers: {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  }
};

console.log(`🔗 Testing connection to: ${SUPABASE_URL}`);
console.log(`🔑 Using key: ${SUPABASE_KEY.substring(0, 20)}...`);

const req = https.request(url, options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ SUCCESS! Supabase connection working');
      console.log('📊 Sample data:', data);
      console.log('\n🚀 Your app should now work properly!');
    } else {
      console.error(`❌ FAILED! Status: ${res.statusCode}`);
      console.error(`📄 Response: ${data}`);
      
      if (res.statusCode === 401) {
        console.log('\n💡 This means your API key is invalid. Please check:');
        console.log('   1. Copy the "anon public" key from Supabase dashboard');
        console.log('   2. Make sure there are no extra spaces or characters');
        console.log('   3. Restart your dev server after updating');
      }
    }
  });
});

req.on('error', (err) => {
  console.error('❌ Network error:', err.message);
});

req.end(); 