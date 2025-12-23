const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

// Backend servers (microservices)
const BACKEND_SERVERS = [
  { url: 'http://localhost:3001', name: 'Backend1-NodeJS', healthy: true, weight: 1 },
  { url: 'http://localhost:3002', name: 'Backend2-Python', healthy: true, weight: 1 }
];

let currentServerIndex = 0; // For round-robin

// Health check function
async function checkServerHealth(server) {
  try {
    const response = await axios.get(`${server.url}/health`, { timeout: 2000 });
    server.healthy = response.status === 200;
    return server.healthy;
  } catch (error) {
    server.healthy = false;
    console.log(`[Load Balancer] ${server.name} is unhealthy`);
    return false;
  }
}

// Periodic health checks
setInterval(async () => {
  for (const server of BACKEND_SERVERS) {
    await checkServerHealth(server);
  }
}, 5000); // Check every 5 seconds

// Initial health check
BACKEND_SERVERS.forEach(server => checkServerHealth(server));

// Load balancing strategies
function getServer(strategy = 'round-robin') {
  const healthyServers = BACKEND_SERVERS.filter(s => s.healthy);
  
  if (healthyServers.length === 0) {
    return null; // No healthy servers
  }
  
  if (strategy === 'round-robin') {
    const server = healthyServers[currentServerIndex % healthyServers.length];
    currentServerIndex = (currentServerIndex + 1) % healthyServers.length;
    return server;
  } else if (strategy === 'weighted') {
    // Simple weighted round-robin
    const totalWeight = healthyServers.reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;
    for (const server of healthyServers) {
      random -= server.weight;
      if (random <= 0) {
        return server;
      }
    }
    return healthyServers[0];
  }
  
  return healthyServers[0];
}

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Load balancer health check
app.get('/health', (req, res) => {
  const healthyCount = BACKEND_SERVERS.filter(s => s.healthy).length;
  res.json({
    status: 'ok',
    service: 'load-balancer',
    healthyBackends: healthyCount,
    totalBackends: BACKEND_SERVERS.length,
    backends: BACKEND_SERVERS.map(s => ({
      name: s.name,
      url: s.url,
      healthy: s.healthy
    }))
  });
});

// Proxy all API requests to backend servers
app.use('/api', async (req, res) => {
  const server = getServer('round-robin');
  
  if (!server) {
    return res.status(503).json({
      error: 'Service unavailable',
      message: 'All backend servers are down'
    });
  }
  
  try {
    const targetUrl = `${server.url}${req.originalUrl}`;
    console.log(`[Load Balancer] ${req.method} ${req.originalUrl} -> ${server.name}`);
    
    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: Object.keys(req.body || {}).length > 0 ? req.body : undefined,
      params: req.query,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
      validateStatus: () => true
    });
    
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error(`[Load Balancer] Error proxying to ${server.name}:`, error.message);
    
    // Try next server if available
    const nextServer = getServer('round-robin');
    if (nextServer && nextServer.url !== server.url) {
      try {
        const retryUrl = `${nextServer.url}${req.originalUrl}`;
        console.log(`[Load Balancer] Retrying with ${nextServer.name}`);
        const retryResponse = await axios({
          method: req.method,
          url: retryUrl,
          data: Object.keys(req.body || {}).length > 0 ? req.body : undefined,
          params: req.query,
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
          validateStatus: () => true
        });
        return res.status(retryResponse.status).json(retryResponse.data);
      } catch (retryError) {
        console.error(`[Load Balancer] Retry also failed:`, retryError.message);
      }
    }
    
    res.status(500).json({
      error: 'Backend service error',
      message: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`⚖️  Load Balancer running on http://localhost:${PORT}`);
  console.log(`📡 Backend servers:`);
  BACKEND_SERVERS.forEach(server => {
    console.log(`   - ${server.name}: ${server.url}`);
  });
  console.log(`🌐 Frontend available at http://localhost:${PORT}`);
});

