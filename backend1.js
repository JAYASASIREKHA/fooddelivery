const express = require('express');
const path = require('path');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 3001;

// Simple JWT-like token generation (for demo - use proper JWT library in production)
function generateToken(userId) {
  const payload = { userId, timestamp: Date.now() };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

function verifyToken(token) {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    return payload;
  } catch (error) {
    return null;
  }
}

// User storage (in-memory)
const users = [];

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'backend1-nodejs-service', language: 'Node.js' });
});

// AUTHENTICATION API

// Register new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }
    
    // Check if user already exists locally
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }
    
    // Check if user exists on Backend2 (Python)
    try {
      const backend2Check = await axios.post('http://localhost:3002/api/auth/register', {
        email, password, name, phone
      }).catch(() => null);
      
      if (backend2Check && backend2Check.status === 201) {
        // User was registered on Backend2, sync to local storage
        const backend2User = backend2Check.data.user;
        users.push({
          id: backend2User.id,
          email: backend2User.email,
          password: crypto.createHash('sha256').update(password).digest('hex'),
          name: backend2User.name,
          phone: backend2User.phone || '',
          createdAt: new Date().toISOString()
        });
        return res.status(201).json(backend2Check.data);
      }
    } catch (syncError) {
      // If Backend2 says user exists, check if we have it locally
      if (syncError.response?.status === 400 && syncError.response?.data?.error?.includes('already exists')) {
        // Try to get user info from Backend2 by attempting login
        try {
          const loginAttempt = await axios.post('http://localhost:3002/api/auth/login', {
            email, password
          });
          if (loginAttempt.status === 200) {
            // User exists on Backend2, sync to local
            const backend2User = loginAttempt.data.user;
            users.push({
              id: backend2User.id,
              email: backend2User.email,
              password: crypto.createHash('sha256').update(password).digest('hex'),
              name: backend2User.name,
              phone: backend2User.phone || '',
              createdAt: new Date().toISOString()
            });
            return res.status(201).json(loginAttempt.data);
          }
        } catch (e) {
          // Continue with local registration
        }
      }
    }
    
    // Create new user locally
    const userId = `USER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    
    const user = {
      id: userId,
      email,
      password: hashedPassword,
      name,
      phone: phone || '',
      createdAt: new Date().toISOString()
    };
    
    users.push(user);
    
    // Sync to Backend2 (non-blocking)
    axios.post('http://localhost:3002/api/auth/register', {
      email, password, name, phone
    }).catch(() => {
      // Silently fail if Backend2 is unavailable
    });
    
    // Generate token
    const token = generateToken(userId);
    
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone
      },
      token
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    let user = users.find(u => u.email === email && u.password === hashedPassword);
    
    // If user not found locally, check Backend2
    if (!user) {
      try {
        const backend2Response = await axios.post('http://localhost:3002/api/auth/login', {
          email, password
        });
        
        if (backend2Response.status === 200) {
          // User exists on Backend2, sync to local storage
          const backend2User = backend2Response.data.user;
          users.push({
            id: backend2User.id,
            email: backend2User.email,
            password: hashedPassword,
            name: backend2User.name,
            phone: backend2User.phone || '',
            createdAt: new Date().toISOString()
          });
          return res.json(backend2Response.data);
        }
      } catch (backend2Error) {
        // If Backend2 also fails, return error
        if (backend2Error.response?.status === 401) {
          return res.status(401).json({ error: 'Invalid email or password' });
        }
      }
      
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Generate token
    const token = generateToken(user.id);
    
    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone
      },
      token
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Get current user (protected route)
app.get('/api/auth/me', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    
    if (!payload) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    const user = users.find(u => u.id === payload.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone
    });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Import all routes from backend2.js (Node.js version)
// For now, we'll keep the same structure but this is Backend1 microservice
const restaurants = [];
const menuItems = [];
const orders = [];
const deliveries = [];
const notifications = [];

const MOCK_PARTNERS = [
  { id: 'DP001', name: 'John Doe', phone: '+1234567890', available: true },
  { id: 'DP002', name: 'Jane Smith', phone: '+1234567891', available: true },
  { id: 'DP003', name: 'Mike Johnson', phone: '+1234567892', available: true },
];

let orderIdCounter = 1;
let deliveryIdCounter = 1;
let notificationIdCounter = 1;

function sendNotification(userId, type, title, message, orderId, status) {
  const notification = {
    id: `NOTIF-${notificationIdCounter++}`,
    userId,
    type,
    title,
    message,
    orderId,
    status,
    timestamp: new Date().toISOString()
  };
  notifications.push(notification);
  console.log(`[NOTIFICATION] ${title}: ${message}`);
  return notification;
}

function assignDeliveryPartner(orderId) {
  const partner = MOCK_PARTNERS[Math.floor(Math.random() * MOCK_PARTNERS.length)];
  const deliveryId = `DEL-${deliveryIdCounter++}`;
  const estimatedTime = new Date();
  estimatedTime.setMinutes(estimatedTime.getMinutes() + 30 + Math.floor(Math.random() * 15));

  const delivery = {
    id: deliveryId,
    deliveryId,
    orderId,
    partnerId: partner.id,
    partnerName: partner.name,
    partnerPhone: partner.phone,
    status: 'ASSIGNED',
    estimatedDeliveryTime: estimatedTime.toISOString(),
    createdAt: new Date().toISOString()
  };
  deliveries.push(delivery);

  sendNotification('user', 'DELIVERY_ASSIGNED', 'Delivery Partner Assigned',
    `Your order ${orderId} has been assigned to ${partner.name}. Estimated delivery: ${estimatedTime.toLocaleTimeString()}`,
    orderId, 'OUT_FOR_DELIVERY');

  return delivery;
}

// RESTAURANT API
app.post('/api/restaurants', async (req, res) => {
  try {
    const { name, cuisine, address, latitude, longitude, phone } = req.body;
    if (!name || !address) {
      return res.status(400).json({ error: 'Name and address are required' });
    }

    const restaurant = {
      id: restaurants.length + 1,
      name,
      cuisine,
      address,
      latitude: parseFloat(latitude || 0),
      longitude: parseFloat(longitude || 0),
      phone,
      isActive: true,
      createdAt: new Date().toISOString()
    };
    restaurants.push(restaurant);
    
    // Sync to Backend2 (non-blocking)
    axios.post('http://localhost:3002/api/restaurants', {
      name, cuisine, address, latitude, longitude, phone
    }).catch(() => {
      // Silently fail if Backend2 is unavailable
    });
    
    res.status(201).json(restaurant);
  } catch (error) {
    console.error('Error creating restaurant:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/restaurants', async (req, res) => {
  try {
    // Get restaurants from Backend2 and merge
    try {
      const backend2Response = await axios.get('http://localhost:3002/api/restaurants', { timeout: 2000 });
      const backend2Restaurants = backend2Response.data || [];
      
      // Merge restaurants, avoiding duplicates by name+address
      const mergedRestaurants = [...restaurants];
      backend2Restaurants.forEach(backend2Rest => {
        const exists = mergedRestaurants.some(r => 
          r.name === backend2Rest.name && r.address === backend2Rest.address
        );
        if (!exists) {
          mergedRestaurants.push(backend2Rest);
        }
      });
      
      return res.json(mergedRestaurants);
    } catch (error) {
      // If Backend2 is unavailable, return local restaurants
      return res.json(restaurants);
    }
  } catch (error) {
    console.error('Error fetching restaurants:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/restaurants/:id', (req, res) => {
  const restaurant = restaurants.find(r => r.id === parseInt(req.params.id));
  if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
  res.json(restaurant);
});

app.get('/api/restaurants/:id/menu', async (req, res) => {
  try {
    const restaurantId = parseInt(req.params.id);
    let localMenu = menuItems.filter(item => item.restaurantId === restaurantId);
    
    // Get menu items from Backend2 and merge
    try {
      const backend2Response = await axios.get(`http://localhost:3002/api/restaurants/${restaurantId}/menu`, { timeout: 2000 });
      const backend2Menu = backend2Response.data || [];
      
      // Merge menu items, avoiding duplicates by name+restaurantId
      const mergedMenu = [...localMenu];
      backend2Menu.forEach(backend2Item => {
        const exists = mergedMenu.some(m => 
          m.name === backend2Item.name && m.restaurantId === backend2Item.restaurantId
        );
        if (!exists) {
          mergedMenu.push(backend2Item);
        }
      });
      
      return res.json(mergedMenu);
    } catch (error) {
      // If Backend2 is unavailable, return local menu
      return res.json(localMenu);
    }
  } catch (error) {
    console.error('Error fetching menu:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/restaurants/:id/menu/items', async (req, res) => {
  try {
    const { name, description, price, category, available } = req.body;
    if (!name || !price) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    const restaurantId = parseInt(req.params.id);
    const menuItem = {
      id: menuItems.length + 1,
      restaurantId: restaurantId,
      name,
      description,
      price: parseFloat(price),
      category: category || 'General',
      available: available !== undefined ? available : true,
      createdAt: new Date().toISOString()
    };
    menuItems.push(menuItem);
    
    // Sync to Backend2 (non-blocking)
    axios.post(`http://localhost:3002/api/restaurants/${restaurantId}/menu/items`, {
      name, description, price, category, available
    }).catch(() => {
      // Silently fail if Backend2 is unavailable
    });
    
    res.status(201).json(menuItem);
  } catch (error) {
    console.error('Error creating menu item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ORDER API
app.post('/api/orders', (req, res) => {
  try {
    const { userId, restaurantId, items, deliveryAddress, deliveryLatitude, deliveryLongitude } = req.body;
    
    if (!userId || !restaurantId || !items || !deliveryAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const restaurant = restaurants.find(r => r.id === parseInt(restaurantId));
    if (!restaurant || !restaurant.isActive) {
      return res.status(400).json({ error: 'Restaurant not available' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array is required and cannot be empty' });
    }

    const validatedItems = [];
    for (const item of items) {
      const menuItem = menuItems.find(m => 
        m.id === item.menuItemId && 
        m.restaurantId === parseInt(restaurantId) &&
        m.available
      );
      if (!menuItem) {
        return res.status(400).json({ 
          error: `Menu item ${item.menuItemId} not found or unavailable for restaurant ${restaurantId}` 
        });
      }
      validatedItems.push({
        ...item,
        menuItemName: menuItem.name,
        price: menuItem.price
      });
    }

    const totalAmount = validatedItems.reduce((sum, item) => 
      sum + (parseFloat(item.price) * item.quantity), 0
    );

    const orderId = `ORD-${orderIdCounter++}`;
    const order = {
      orderId,
      id: orders.length + 1,
      userId,
      restaurantId: parseInt(restaurantId),
      status: 'CREATED',
      totalAmount,
      items: validatedItems,
      deliveryAddress,
      deliveryLatitude: parseFloat(deliveryLatitude),
      deliveryLongitude: parseFloat(deliveryLongitude),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    orders.push(order);

    sendNotification(userId, 'ORDER_CREATED', 'Order Placed Successfully',
      `Your order ${orderId} has been placed. Total: $${totalAmount.toFixed(2)}`,
      orderId, 'CREATED');

    res.status(201).json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

app.get('/api/orders', (req, res) => {
  res.json(orders);
});

app.get('/api/orders/:orderId', (req, res) => {
  const order = orders.find(o => o.orderId === req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

app.post('/api/orders/:orderId/restaurant-action', (req, res) => {
  const { action } = req.body;
  const order = orders.find(o => o.orderId === req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (action === 'accept') {
    order.status = 'CONFIRMED';
    sendNotification(order.userId, 'ORDER_CONFIRMED', 'Order Confirmed',
      `Your order ${order.orderId} has been confirmed by the restaurant.`,
      order.orderId, 'CONFIRMED');
  } else if (action === 'reject') {
    order.status = 'CANCELLED';
    sendNotification(order.userId, 'ORDER_CANCELLED', 'Order Cancelled',
      `Your order ${order.orderId} has been cancelled.`,
      order.orderId, 'CANCELLED');
  }

  order.updatedAt = new Date().toISOString();
  res.json(order);
});

app.patch('/api/orders/:orderId/status', (req, res) => {
  const { status } = req.body;
  const order = orders.find(o => o.orderId === req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const validStatuses = ['CREATED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  order.status = status;
  order.updatedAt = new Date().toISOString();

  if (status === 'PREPARING') {
    const delivery = assignDeliveryPartner(order.orderId);
    order.deliveryId = delivery.deliveryId;
    sendNotification(order.userId, 'ORDER_PREPARING', 'Order Being Prepared',
      `Your order ${order.orderId} is being prepared.`,
      order.orderId, 'PREPARING');
  }

  if (status === 'OUT_FOR_DELIVERY') {
    sendNotification(order.userId, 'ORDER_OUT_FOR_DELIVERY', 'Order Out for Delivery',
      `Your order ${order.orderId} is on the way!`,
      order.orderId, 'OUT_FOR_DELIVERY');
  }

  if (status === 'DELIVERED') {
    sendNotification(order.userId, 'ORDER_DELIVERED', 'Order Delivered',
      `Your order ${order.orderId} has been delivered. Enjoy your meal!`,
      order.orderId, 'DELIVERED');
  }

  res.json(order);
});

app.get('/api/deliveries', (req, res) => {
  res.json(deliveries);
});

app.get('/api/notifications', (req, res) => {
  res.json(notifications);
});

app.listen(PORT, () => {
  console.log(`🚀 Backend 1 (Node.js Microservice) running on http://localhost:${PORT}`);
  console.log(`✅ Ready to receive requests from Load Balancer`);
});

