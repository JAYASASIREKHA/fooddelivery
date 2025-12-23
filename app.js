const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

// In-memory databases (for simplicity - single file app)
const restaurants = [];
const menuItems = [];
const orders = [];
const deliveries = [];
const notifications = [];

// Mock delivery partners
const MOCK_PARTNERS = [
  { id: 'DP001', name: 'John Doe', phone: '+1234567890', available: true },
  { id: 'DP002', name: 'Jane Smith', phone: '+1234567891', available: true },
  { id: 'DP003', name: 'Mike Johnson', phone: '+1234567892', available: true },
];

let orderIdCounter = 1;
let deliveryIdCounter = 1;
let notificationIdCounter = 1;

// Helper functions
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

// Routes

// Root route - serve UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// RESTAURANT API

app.post('/api/restaurants', (req, res) => {
  const { name, cuisine, address, latitude, longitude, phone } = req.body;
  if (!name || !address) {
    return res.status(400).json({ error: 'Name and address are required' });
  }

  const restaurant = {
    id: restaurants.length + 1,
    name,
    cuisine,
    address,
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    phone,
    isActive: true,
    createdAt: new Date().toISOString()
  };
  restaurants.push(restaurant);
  res.status(201).json(restaurant);
});

app.get('/api/restaurants', (req, res) => {
  res.json(restaurants);
});

app.get('/api/restaurants/:id', (req, res) => {
  const restaurant = restaurants.find(r => r.id === parseInt(req.params.id));
  if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
  res.json(restaurant);
});

// Toggle restaurant availability
app.patch('/api/restaurants/:id/availability', (req, res) => {
  const restaurant = restaurants.find(r => r.id === parseInt(req.params.id));
  if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
  const { isActive } = req.body;
  restaurant.isActive = isActive !== undefined ? !!isActive : restaurant.isActive;
  res.json(restaurant);
});

app.get('/api/restaurants/:id/menu', (req, res) => {
  const menu = menuItems.filter(item => item.restaurantId === parseInt(req.params.id));
  res.json(menu);
});

app.post('/api/restaurants/:id/menu/items', (req, res) => {
  const { name, description, price, category, available } = req.body;
  if (!name || !price) {
    return res.status(400).json({ error: 'Name and price are required' });
  }

  const menuItem = {
    id: menuItems.length + 1,
    restaurantId: parseInt(req.params.id),
    name,
    description,
    price: parseFloat(price),
    category: category || 'General',
    available: available !== undefined ? available : true,
    createdAt: new Date().toISOString()
  };
  menuItems.push(menuItem);
  res.status(201).json(menuItem);
});

app.put('/api/restaurants/:restaurantId/menu/items/:itemId', (req, res) => {
  const item = menuItems.find(m => 
    m.restaurantId === parseInt(req.params.restaurantId) && 
    m.id === parseInt(req.params.itemId)
  );
  if (!item) return res.status(404).json({ error: 'Menu item not found' });

  Object.assign(item, req.body, { updatedAt: new Date().toISOString() });
  res.json(item);
});

// Toggle menu item availability
app.patch('/api/restaurants/:restaurantId/menu/items/:itemId/availability', (req, res) => {
  const item = menuItems.find(m =>
    m.restaurantId === parseInt(req.params.restaurantId) &&
    m.id === parseInt(req.params.itemId)
  );
  if (!item) return res.status(404).json({ error: 'Menu item not found' });
  const { available } = req.body;
  item.available = available !== undefined ? !!available : item.available;
  item.updatedAt = new Date().toISOString();
  res.json(item);
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

    // Validate menu items
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

  // Auto-assign delivery when preparing
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

// DELIVERY API

app.get('/api/deliveries', (req, res) => {
  res.json(deliveries);
});

app.get('/api/deliveries/order/:orderId', (req, res) => {
  const delivery = deliveries.find(d => d.orderId === req.params.orderId);
  if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
  res.json(delivery);
});

app.patch('/api/deliveries/:deliveryId/status', (req, res) => {
  const { status } = req.body;
  const delivery = deliveries.find(d => d.deliveryId === req.params.deliveryId);
  if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

  delivery.status = status;
  delivery.updatedAt = new Date().toISOString();

  // Update order status when delivered
  if (status === 'DELIVERED') {
    const order = orders.find(o => o.orderId === delivery.orderId);
    if (order) {
      order.status = 'DELIVERED';
      order.updatedAt = new Date().toISOString();
    }
  }

  res.json(delivery);
});

// NOTIFICATION API

app.get('/api/notifications', (req, res) => {
  res.json(notifications);
});

app.get('/api/notifications/user/:userId', (req, res) => {
  const userNotifications = notifications.filter(n => n.userId === req.params.userId);
  res.json(userNotifications);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'food-delivery-app' });
});

app.listen(PORT, () => {
  console.log(`Food Delivery App running on http://localhost:${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});

