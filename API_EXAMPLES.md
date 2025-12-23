# API Examples - Food Delivery System

This document provides example API calls to test the food delivery system.

## Prerequisites

All services should be running. Start them with:
```bash
docker-compose up
```

## Restaurant Service (Port 3001)

### 1. Register a Restaurant
```bash
curl -X POST http://localhost:3001/api/restaurants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Pizza Palace",
    "cuisine": "Italian",
    "address": "123 Main St, New York, NY",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "phone": "+1234567890"
  }'
```

### 2. Get Nearby Restaurants
```bash
curl "http://localhost:3001/api/restaurants/nearby?latitude=40.7128&longitude=-74.0060&radius=5"
```

### 3. Get Restaurant Menu
```bash
curl http://localhost:3001/api/restaurants/1/menu
```

### 4. Add Menu Item
```bash
curl -X POST http://localhost:3001/api/restaurants/1/menu/items \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Margherita Pizza",
    "description": "Classic pizza with tomato and mozzarella",
    "price": 12.99,
    "category": "Pizza",
    "available": true
  }'
```

### 5. Update Menu Item
```bash
curl -X PUT http://localhost:3001/api/restaurants/1/menu/items/1 \
  -H "Content-Type: application/json" \
  -d '{
    "price": 13.99,
    "available": true
  }'
```

## Order Service (Port 3002)

### 1. Create an Order
```bash
curl -X POST http://localhost:3002/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "restaurantId": 1,
    "items": [
      {
        "menuItemId": 1,
        "quantity": 2,
        "price": 12.99
      }
    ],
    "deliveryAddress": "456 Oak Ave, New York, NY",
    "deliveryLatitude": 40.7580,
    "deliveryLongitude": -74.9855
  }'
```

**Save the `order_id` from the response for next steps!**

### 2. Get Order Status
```bash
curl http://localhost:3002/api/orders/ORD-1234567890-abc123
```

### 3. Restaurant Accepts Order
```bash
curl -X POST http://localhost:3002/api/orders/ORD-1234567890-abc123/restaurant-action \
  -H "Content-Type: application/json" \
  -d '{
    "action": "accept"
  }'
```

### 4. Update Order Status to Preparing
```bash
curl -X PATCH http://localhost:3002/api/orders/ORD-1234567890-abc123/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "PREPARING"
  }'
```

### 5. Get User Orders
```bash
curl http://localhost:3002/api/orders/user/user123
```

## Delivery Service (Port 3003)

### 1. Assign Delivery Partner (Manual)
```bash
curl -X POST http://localhost:3003/api/deliveries/assign \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORD-1234567890-abc123"
  }'
```

**Note:** Delivery is auto-assigned when order status changes to PREPARING.

### 2. Get Delivery Status
```bash
curl http://localhost:3003/api/deliveries/DEL-1234567890-xyz789
```

### 3. Get Delivery by Order ID
```bash
curl http://localhost:3003/api/deliveries/order/ORD-1234567890-abc123
```

### 4. Update Delivery Status
```bash
curl -X PATCH http://localhost:3003/api/deliveries/DEL-1234567890-xyz789/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "OUT_FOR_DELIVERY"
  }'
```

### 5. Simulate Delivery Progress (Testing)
```bash
curl -X POST http://localhost:3003/api/deliveries/DEL-1234567890-xyz789/simulate
```

This will automatically progress through: ASSIGNED → PICKED_UP → OUT_FOR_DELIVERY → DELIVERED

## Notification Service (Port 3004)

### 1. Get User Notifications
```bash
curl http://localhost:3004/api/notifications/user/user123
```

### 2. Get All Notifications
```bash
curl http://localhost:3004/api/notifications
```

## Complete Order Flow Example

Here's a complete workflow to test the entire system:

```bash
# Step 1: Register a restaurant
RESTAURANT_RESPONSE=$(curl -s -X POST http://localhost:3001/api/restaurants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Burger King",
    "cuisine": "American",
    "address": "789 Broadway, New York, NY",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "phone": "+1234567891"
  }')

RESTAURANT_ID=$(echo $RESTAURANT_RESPONSE | grep -o '"id":[0-9]*' | grep -o '[0-9]*')

# Step 2: Add menu items
curl -X POST http://localhost:3001/api/restaurants/$RESTAURANT_ID/menu/items \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Whopper",
    "description": "Flame-grilled beef patty",
    "price": 8.99,
    "category": "Burgers",
    "available": true
  }'

# Step 3: Create an order
ORDER_RESPONSE=$(curl -s -X POST http://localhost:3002/api/orders \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"user456\",
    \"restaurantId\": $RESTAURANT_ID,
    \"items\": [
      {
        \"menuItemId\": 1,
        \"quantity\": 1,
        \"price\": 8.99
      }
    ],
    \"deliveryAddress\": \"123 Test St\",
    \"deliveryLatitude\": 40.7580,
    \"deliveryLongitude\": -74.9855
  }")

ORDER_ID=$(echo $ORDER_RESPONSE | grep -o '"order_id":"[^"]*"' | cut -d'"' -f4)
echo "Order ID: $ORDER_ID"

# Step 4: Restaurant accepts order
curl -X POST http://localhost:3002/api/orders/$ORDER_ID/restaurant-action \
  -H "Content-Type: application/json" \
  -d '{"action": "accept"}'

# Step 5: Update to preparing (triggers delivery assignment)
curl -X PATCH http://localhost:3002/api/orders/$ORDER_ID/status \
  -H "Content-Type: application/json" \
  -d '{"status": "PREPARING"}'

# Step 6: Check delivery status
DELIVERY_RESPONSE=$(curl -s http://localhost:3003/api/deliveries/order/$ORDER_ID)
DELIVERY_ID=$(echo $DELIVERY_RESPONSE | grep -o '"delivery_id":"[^"]*"' | cut -d'"' -f4)

# Step 7: Simulate delivery progress
curl -X POST http://localhost:3003/api/deliveries/$DELIVERY_ID/simulate
curl -X POST http://localhost:3003/api/deliveries/$DELIVERY_ID/simulate
curl -X POST http://localhost:3003/api/deliveries/$DELIVERY_ID/simulate

# Step 8: Check notifications
curl http://localhost:3004/api/notifications/user/user456

# Step 9: Check final order status
curl http://localhost:3002/api/orders/$ORDER_ID
```

## Health Checks

Test if all services are running:

```bash
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
```

## RabbitMQ Management

Access RabbitMQ Management UI at: http://localhost:15672
- Username: admin
- Password: admin

You can monitor queues and messages here.

