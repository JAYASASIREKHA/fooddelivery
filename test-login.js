const axios = require('axios');

const API_BASE = 'http://localhost:3000';

async function testLogin() {
  console.log('🧪 Testing User Registration and Login...\n');
  
  const testUser = {
    name: 'Test User',
    email: `test${Date.now()}@example.com`,
    password: 'testpassword123',
    phone: '+1234567890'
  };
  
  try {
    // Step 1: Register user
    console.log('1️⃣ Registering user...');
    const registerResponse = await axios.post(`${API_BASE}/api/auth/register`, testUser);
    console.log('✅ Registration successful!');
    console.log(`   User ID: ${registerResponse.data.user.id}`);
    console.log(`   Email: ${registerResponse.data.user.email}`);
    console.log(`   Name: ${registerResponse.data.user.name}`);
    console.log(`   Token: ${registerResponse.data.token.substring(0, 20)}...\n`);
    
    // Step 2: Login with registered credentials
    console.log('2️⃣ Logging in with registered credentials...');
    const loginResponse = await axios.post(`${API_BASE}/api/auth/login`, {
      email: testUser.email,
      password: testUser.password
    });
    console.log('✅ Login successful!');
    console.log(`   User ID: ${loginResponse.data.user.id}`);
    console.log(`   Email: ${loginResponse.data.user.email}`);
    console.log(`   Name: ${loginResponse.data.user.name}`);
    console.log(`   Token: ${loginResponse.data.token.substring(0, 20)}...\n`);
    
    // Step 3: Verify tokens match (they should be different but valid)
    console.log('3️⃣ Verifying authentication...');
    const meResponse = await axios.get(`${API_BASE}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${loginResponse.data.token}`
      }
    });
    console.log('✅ Authentication verified!');
    console.log(`   Current user: ${meResponse.data.user.name} (${meResponse.data.user.email})\n`);
    
    console.log('🎉 All tests passed! User can register and login successfully.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

testLogin();

