# Food Delivery System - Quick Start

## 🚀 Single File Application with Interactive UI

This is an all-in-one food delivery system with a beautiful web interface!

## Start the Application

```bash
npm start
```

Then open your browser to: **http://localhost:3000**

## Features

### 🏪 Restaurants Tab
- Add new restaurants
- View restaurant list
- Add menu items to restaurants
- View restaurant menus

### 📦 Orders Tab
- Create new orders
- View all orders
- Accept/reject orders (as restaurant)
- Update order status (PREPARING → OUT_FOR_DELIVERY → DELIVERED)

### 🚚 Deliveries Tab
- View all deliveries
- See delivery partner assignments
- Track delivery status

### 🔔 Notifications Tab
- View all notifications
- Real-time updates on order status changes
- Auto-refreshes every 2 seconds

## How to Use

1. **Add a Restaurant:**
   - Go to Restaurants tab
   - Fill in restaurant details
   - Click "Add Restaurant"

2. **Add Menu Items:**
   - Click "Add Menu Item" on any restaurant card
   - Enter item details

3. **Create an Order:**
   - Go to Orders tab
   - Select a restaurant
   - Add menu items (you'll need the menu item IDs from the restaurant menu)
   - Fill in delivery address
   - Click "Create Order"

4. **Process Order:**
   - Accept/Reject the order
   - Update status as it progresses
   - Watch notifications update automatically

## All Data is Stored In-Memory

- Restaurants, orders, deliveries, and notifications are stored in memory
- Data persists while the server is running
- Restarting the server clears all data

## API Endpoints

All REST APIs are available:
- `GET /api/restaurants` - List restaurants
- `POST /api/restaurants` - Create restaurant
- `GET /api/orders` - List orders
- `POST /api/orders` - Create order
- `GET /api/deliveries` - List deliveries
- `GET /api/notifications` - List notifications

Enjoy! 🎉

