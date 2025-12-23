const axios = require('axios');

const API_BASE = 'http://localhost:3000';

const testUsers = [
  { name: 'John Doe', email: 'john@example.com', password: 'password123', phone: '+1234567890' },
  { name: 'Jane Smith', email: 'jane@example.com', password: 'password123', phone: '+1234567891' },
  { name: 'Mike Johnson', email: 'mike@example.com', password: 'password123', phone: '+1234567892' },
  { name: 'Sarah Williams', email: 'sarah@example.com', password: 'password123', phone: '+1234567893' },
  { name: 'David Brown', email: 'david@example.com', password: 'password123', phone: '+1234567894' },
  { name: 'Emily Davis', email: 'emily@example.com', password: 'password123', phone: '+1234567895' },
  { name: 'Chris Wilson', email: 'chris@example.com', password: 'password123', phone: '+1234567896' },
  { name: 'Lisa Anderson', email: 'lisa@example.com', password: 'password123', phone: '+1234567897' },
  { name: 'Tom Martinez', email: 'tom@example.com', password: 'password123', phone: '+1234567898' },
  { name: 'Amy Taylor', email: 'amy@example.com', password: 'password123', phone: '+1234567899' },
];

async function registerUsers() {
  console.log('🚀 Registering test users...\n');
  
  const results = {
    success: [],
    failed: []
  };
  
  for (const user of testUsers) {
    let retries = 2;
    let registered = false;
    
    while (retries > 0 && !registered) {
      try {
        const response = await axios.post(`${API_BASE}/api/auth/register`, user, {
          timeout: 5000
        });
        results.success.push({
          name: user.name,
          email: user.email,
          userId: response.data.user.id
        });
        console.log(`✅ Registered: ${user.name} (${user.email})`);
        registered = true;
      } catch (error) {
        if (error.response?.status === 400 && error.response?.data?.error?.includes('already exists')) {
          // User already exists, treat as success
          results.success.push({
            name: user.name,
            email: user.email,
            userId: 'existing'
          });
          console.log(`ℹ️  Already exists: ${user.name} (${user.email})`);
          registered = true;
        } else if (retries > 1) {
          // Retry on 404 or network errors
          await new Promise(resolve => setTimeout(resolve, 500));
          retries--;
        } else {
          const message = error.response?.data?.error || error.message;
          results.failed.push({
            name: user.name,
            email: user.email,
            error: message
          });
          console.log(`❌ Failed: ${user.name} (${user.email}) - ${message}`);
          retries = 0;
        }
      }
    }
    
    // Small delay between registrations
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log('\n📊 Summary:');
  console.log(`✅ Successfully registered: ${results.success.length} users`);
  console.log(`❌ Failed: ${results.failed.length} users`);
  
  if (results.success.length > 0) {
    console.log('\n✅ Successfully registered users:');
    results.success.forEach(u => {
      console.log(`   - ${u.name} (${u.email}) - ID: ${u.userId}`);
    });
  }
  
  if (results.failed.length > 0) {
    console.log('\n❌ Failed registrations:');
    results.failed.forEach(u => {
      console.log(`   - ${u.name} (${u.email}) - Error: ${u.error}`);
    });
  }
  
  console.log('\n💡 You can now login with any of these users:');
  console.log('   Email: john@example.com, Password: password123');
  console.log('   Email: jane@example.com, Password: password123');
  console.log('   ... and so on');
}

registerUsers().catch(console.error);

