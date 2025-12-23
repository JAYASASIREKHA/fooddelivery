# Food Delivery Backend System

A scalable, microservices-based food delivery backend system built with Node.js, PostgreSQL, Redis, and RabbitMQ.

## Architecture

The system consists of four independent microservices:

1. **Restaurant Service** (Port 3001)
   - Restaurant registration and management
   - Menu management (CRUD operations)
   - Restaurant listing with Redis caching for high read performance

2. **Order Service** (Port 3002)
   - Order creation and lifecycle management
   - Order state transitions (CREATED → CONFIRMED → PREPARING → OUT_FOR_DELIVERY → DELIVERED → CANCELLED)
   - Integration with Restaurant Service for menu validation

3. **Delivery Service** (Port 3003)
   - Mock delivery partner assignment
   - Delivery status tracking and simulation
   - Live delivery updates

4. **Notification Service** (Port 3004)
   - Asynchronous notification processing
   - Email/SMS/Push notifications (mocked)
   - Event-driven architecture via RabbitMQ

## Technology Stack

- **Runtime**: Node.js with Express.js
- **Databases**: PostgreSQL (separate database per service)
- **Cache**: Redis (for restaurant listings)
- **Message Queue**: RabbitMQ (for async communication)
- **Containerization**: Docker & Docker Compose

## Features

### User Features
- ✅ View list of nearby restaurants
- ✅ View restaurant menu
- ✅ Place an order
- ✅ Track order status
- ✅ Receive notifications on status changes

### Restaurant Features
- ✅ Register restaurant
- ✅ Add/update menu items
- ✅ Accept or reject orders
- ✅ Update food preparation status

### System Features
- ✅ High availability through service separation
- ✅ Low latency for restaurant listing (Redis caching)
- ✅ Eventual consistency
- ✅ Independent service scaling
- ✅ Fault tolerance through message queue

## Getting Started

### Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ (for local development)

### Quick Start with Docker

1. Clone the repository and navigate to the project directory

2. Start all services:
```bash
docker-compose up --build
```

3. Services will be available at:
   - Restaurant Service: http://localhost:3001
   - Order Service: http://localhost:3002
   - Delivery Service: http://localhost:3003
   - Notification Service: http://localhost:3004
   - RabbitMQ Management: http://localhost:15672 (admin/admin)

### Local Development

1. Install dependencies:
```bash
npm run install:all
```

2. Start infrastructure services:
```bash
docker-compose up postgres-restaurant postgres-order postgres-delivery redis rabbitmq
```

3. Start services individually:
```bash
npm run start:restaurant
npm run start:order
npm run start:delivery
npm run start:notification
```

## Quick Start Guide

### Using Docker (Recommended)

1. **Start all services:**
   ```bash
   docker-compose up --build
   ```

2. **Wait for all services to be ready** (check logs for "running on port" messages)

3. **Test the system:**
   - See `API_EXAMPLES.md` for detailed API examples
   - Or use the health check endpoints:
     ```bash
     curl http://localhost:3001/health
     curl http://localhost:3002/health
     curl http://localhost:3003/health
     curl http://localhost:3004/health
     ```

### Local Development

1. **Start infrastructure services:**
   ```bash
   docker-compose up postgres-restaurant postgres-order postgres-delivery redis rabbitmq
   ```

2. **Install dependencies:**
   ```bash
   npm run install:all
   ```

3. **Start services in separate terminals:**
   ```bash
   # Terminal 1
   npm run start:restaurant

   # Terminal 2
   npm run start:order

   # Terminal 3
   npm run start:delivery

   # Terminal 4
   npm run start:notification
   ```

## API Documentation

### Restaurant Service

#### Register Restaurant
```
POST /api/restaurants
Content-Type: application/json

{
  "name": "Pizza Palace",
  "cuisine": "Italian",
  "address": "123 Main St",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "phone": "+1234567890"
}
```

#### Get Nearby Restaurants
```
GET /api/restaurants/nearby?latitude=40.7128&longitude=-74.0060&radius=5
```

#### Get Restaurant Menu
```
GET /api/restaurants/:restaurantId/menu
```

#### Add Menu Item
```
POST /api/restaurants/:restaurantId/menu/items
Content-Type: application/json

{
  "name": "Margherita Pizza",
  "description": "Classic pizza with tomato and mozzarella",
  "price": 12.99,
  "category": "Pizza",
  "available": true
}
```

#### Update Menu Item
```
PUT /api/restaurants/:restaurantId/menu/items/:itemId
Content-Type: application/json

{
  "name": "Margherita Pizza",
  "price": 13.99,
  "available": true
}
```

### Order Service

#### Create Order
```
POST /api/orders
Content-Type: application/json

{
  "userId": "user123",
  "restaurantId": 1,
  "items": [
    {
      "menuItemId": 1,
      "quantity": 2,
      "price": 12.99
    }
  ],
  "deliveryAddress": "456 Oak Ave",
  "deliveryLatitude": 40.7580,
  "deliveryLongitude": -74.9855
}
```

#### Get Order Status
```
GET /api/orders/:orderId
```

#### Update Order Status (Restaurant)
```
PATCH /api/orders/:orderId/status
Content-Type: application/json

{
  "status": "PREPARING"
}
```

#### Accept/Reject Order
```
POST /api/orders/:orderId/restaurant-action
Content-Type: application/json

{
  "action": "accept" // or "reject"
}
```

### Delivery Service

#### Assign Delivery Partner
```
POST /api/deliveries/assign
Content-Type: application/json

{
  "orderId": "order123"
}
```

#### Update Delivery Status
```
PATCH /api/deliveries/:deliveryId/status
Content-Type: application/json

{
  "status": "OUT_FOR_DELIVERY"
}
```

#### Get Delivery Status
```
GET /api/deliveries/:deliveryId
```

## System Design Principles

1. **Service Separation**: Each service has its own database and can scale independently
2. **Event-Driven Architecture**: Services communicate asynchronously via RabbitMQ
3. **Caching Strategy**: Redis caching for read-heavy restaurant listings
4. **Fault Tolerance**: Message queue ensures message delivery even if services are temporarily down
5. **Eventual Consistency**: Order status updates propagate asynchronously

## Order Flow

1. User places order → Order Service creates order (status: CREATED)
2. Order Service publishes order event → Restaurant Service receives notification
3. Restaurant accepts/rejects → Order status updated to CONFIRMED or CANCELLED
4. Restaurant updates status to PREPARING → Notification sent to user
5. Order Service triggers delivery assignment → Delivery Service assigns partner
6. Delivery Service updates status to OUT_FOR_DELIVERY → Notification sent
7. Delivery Service updates status to DELIVERED → Final notification sent

## Testing

Test the system using the provided API endpoints. Example workflow:

1. Register a restaurant
2. Add menu items
3. Create an order
4. Accept the order from restaurant
5. Track order status updates
6. Check notifications

## License

MIT

