const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const redis = require('redis');
const amqp = require('amqplib');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'restaurant_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// Redis connection
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.connect().catch(console.error);

// Initialize database
async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS restaurants (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        cuisine VARCHAR(100),
        address TEXT,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        phone VARCHAR(20),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id SERIAL PRIMARY KEY,
        restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        category VARCHAR(100),
        available BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// RabbitMQ connection for order events
let orderChannel;
async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost:5672');
    orderChannel = await connection.createChannel();
    
    // Queue for receiving order events
    await orderChannel.assertQueue('order.events', { durable: true });
    
    // Consume order events
    orderChannel.consume('order.events', async (msg) => {
      if (msg) {
        const orderData = JSON.parse(msg.content.toString());
        console.log('Received order event:', orderData);
        // Handle order events (e.g., notify restaurant of new order)
        orderChannel.ack(msg);
      }
    });

    console.log('Connected to RabbitMQ');
  } catch (error) {
    console.error('RabbitMQ connection error:', error);
  }
}

// Routes

// Register restaurant
app.post('/api/restaurants', async (req, res) => {
  try {
    const { name, cuisine, address, latitude, longitude, phone } = req.body;
    
    if (!name || !address) {
      return res.status(400).json({ error: 'Name and address are required' });
    }

    const result = await pool.query(
      `INSERT INTO restaurants (name, cuisine, address, latitude, longitude, phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, cuisine, address, latitude, longitude, phone]
    );

    // Invalidate cache
    await redisClient.del('restaurants:nearby:*');

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating restaurant:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get nearby restaurants (with Redis caching)
app.get('/api/restaurants/nearby', async (req, res) => {
  try {
    const { latitude, longitude, radius = 5 } = req.query;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const cacheKey = `restaurants:nearby:${latitude}:${longitude}:${radius}`;
    
    // Try to get from cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // Calculate distance using Haversine formula (simplified)
    const result = await pool.query(
      `SELECT id, name, cuisine, address, latitude, longitude, phone,
              (6371 * acos(
                cos(radians($1)) * cos(radians(latitude)) *
                cos(radians(longitude) - radians($2)) +
                sin(radians($1)) * sin(radians(latitude))
              )) AS distance
       FROM restaurants
       WHERE is_active = true
       HAVING (6371 * acos(
         cos(radians($1)) * cos(radians(latitude)) *
         cos(radians(longitude) - radians($2)) +
         sin(radians($1)) * sin(radians(latitude))
       )) <= $3
       ORDER BY distance
       LIMIT 50`,
      [parseFloat(latitude), parseFloat(longitude), parseFloat(radius)]
    );

    const restaurants = result.rows;
    
    // Cache for 5 minutes
    await redisClient.setEx(cacheKey, 300, JSON.stringify(restaurants));

    res.json(restaurants);
  } catch (error) {
    console.error('Error fetching nearby restaurants:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get restaurant by ID
app.get('/api/restaurants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM restaurants WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching restaurant:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get restaurant menu
app.get('/api/restaurants/:id/menu', async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `restaurant:${id}:menu`;
    
    // Try cache first
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const result = await pool.query(
      'SELECT * FROM menu_items WHERE restaurant_id = $1 ORDER BY category, name',
      [id]
    );

    const menu = result.rows;
    
    // Cache for 2 minutes
    await redisClient.setEx(cacheKey, 120, JSON.stringify(menu));

    res.json(menu);
  } catch (error) {
    console.error('Error fetching menu:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add menu item
app.post('/api/restaurants/:id/menu/items', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, category, available } = req.body;
    
    if (!name || !price) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    const result = await pool.query(
      `INSERT INTO menu_items (restaurant_id, name, description, price, category, available)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, name, description, price, category, available !== undefined ? available : true]
    );

    // Invalidate menu cache
    await redisClient.del(`restaurant:${id}:menu`);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating menu item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update menu item
app.put('/api/restaurants/:restaurantId/menu/items/:itemId', async (req, res) => {
  try {
    const { restaurantId, itemId } = req.params;
    const { name, description, price, category, available } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (price !== undefined) {
      updates.push(`price = $${paramCount++}`);
      values.push(price);
    }
    if (category !== undefined) {
      updates.push(`category = $${paramCount++}`);
      values.push(category);
    }
    if (available !== undefined) {
      updates.push(`available = $${paramCount++}`);
      values.push(available);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(restaurantId, itemId);

    const result = await pool.query(
      `UPDATE menu_items 
       SET ${updates.join(', ')}
       WHERE restaurant_id = $${paramCount++} AND id = $${paramCount++}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    // Invalidate menu cache
    await redisClient.del(`restaurant:${restaurantId}:menu`);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating menu item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get menu item by ID (for order validation)
app.get('/api/restaurants/:restaurantId/menu/items/:itemId', async (req, res) => {
  try {
    const { restaurantId, itemId } = req.params;
    const result = await pool.query(
      'SELECT * FROM menu_items WHERE restaurant_id = $1 AND id = $2',
      [restaurantId, itemId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching menu item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'restaurant-service' });
});

// Initialize and start server
async function start() {
  await initializeDatabase();
  await connectRabbitMQ();
  
  app.listen(PORT, () => {
    console.log(`Restaurant Service running on port ${PORT}`);
  });
}

start().catch(console.error);

