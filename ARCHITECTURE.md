# System Architecture

## Overview

The Food Delivery Backend System is built using a **microservices architecture** with four independent services, each with its own database and responsibilities.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Applications                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────┐
        │         API Gateway (Future Enhancement)     │
        └─────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  Restaurant  │      │    Order     │      │   Delivery   │
│   Service    │      │   Service    │      │   Service    │
│   (3001)     │      │   (3002)      │      │   (3003)     │
└──────────────┘      └──────────────┘      └──────────────┘
        │                     │                     │
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  PostgreSQL  │      │  PostgreSQL  │      │  PostgreSQL  │
│ Restaurant DB│      │   Order DB   │      │ Delivery DB  │
└──────────────┘      └──────────────┘      └──────────────┘
        │
        ▼
┌──────────────┐
│     Redis    │
│    (Cache)   │
└──────────────┘

        ┌─────────────────────────────────────────────┐
        │            RabbitMQ Message Queue            │
        │  (Event-Driven Communication)                │
        └─────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Notification   │
                    │    Service      │
                    │    (3004)       │
                    └──────────────────┘
```

## Service Details

### 1. Restaurant Service (Port 3001)

**Responsibilities:**
- Restaurant registration and management
- Menu item CRUD operations
- Restaurant listing with geolocation search
- Menu retrieval

**Database:** PostgreSQL (restaurant_db)
- `restaurants` table
- `menu_items` table

**Cache:** Redis
- Caches nearby restaurant queries (5 min TTL)
- Caches restaurant menus (2 min TTL)

**Key Features:**
- High read performance through Redis caching
- Geolocation-based restaurant search
- Menu availability management

### 2. Order Service (Port 3002)

**Responsibilities:**
- Order creation and validation
- Order lifecycle management
- Order state transitions
- Integration with Restaurant Service for menu validation

**Database:** PostgreSQL (order_db)
- `orders` table
- `order_items` table

**Order States:**
- `CREATED` → `CONFIRMED` → `PREPARING` → `OUT_FOR_DELIVERY` → `DELIVERED`
- `CANCELLED` (can occur at any stage)

**Key Features:**
- Validates menu items before order creation
- Publishes events for each state change
- Restaurant can accept/reject orders

### 3. Delivery Service (Port 3003)

**Responsibilities:**
- Delivery partner assignment (mocked)
- Delivery status tracking
- Live delivery updates

**Database:** PostgreSQL (delivery_db)
- `deliveries` table

**Delivery States:**
- `ASSIGNED` → `PICKED_UP` → `OUT_FOR_DELIVERY` → `DELIVERED`

**Key Features:**
- Auto-assigns delivery partner when order is ready
- Mock delivery partners (5 available)
- Simulates delivery progress
- Updates order status when delivered

### 4. Notification Service (Port 3004)

**Responsibilities:**
- Asynchronous notification processing
- Multi-channel notifications (Email, SMS, Push - all mocked)
- Event-driven notification triggers

**Storage:** In-memory (for demo; use database in production)

**Key Features:**
- Listens to all order and delivery events
- Sends notifications via all channels
- Notification history tracking

## Communication Patterns

### Synchronous Communication
- **Order Service → Restaurant Service**: HTTP REST API calls for menu validation

### Asynchronous Communication
- **All Services → RabbitMQ**: Event publishing
- **Notification Service ← RabbitMQ**: Event consumption
- **Delivery Service ← RabbitMQ**: Order ready events

## Event Flow

### Order Creation Flow

```
1. User creates order
   ↓
2. Order Service validates menu items (HTTP call to Restaurant Service)
   ↓
3. Order created with status CREATED
   ↓
4. Event: order.created → RabbitMQ
   ↓
5. Notification Service sends "Order Placed" notification
```

### Order Confirmation Flow

```
1. Restaurant accepts order
   ↓
2. Order status: CREATED → CONFIRMED
   ↓
3. Events: order.confirmed, order.status.updated → RabbitMQ
   ↓
4. Notification Service sends "Order Confirmed" notification
```

### Order Preparation Flow

```
1. Restaurant updates order to PREPARING
   ↓
2. Order status: CONFIRMED → PREPARING
   ↓
3. Events: order.preparing, order.ready, order.status.updated → RabbitMQ
   ↓
4. Delivery Service consumes order.ready → Auto-assigns delivery partner
   ↓
5. Notification Service sends "Order Being Prepared" notification
```

### Delivery Flow

```
1. Delivery Service assigns partner
   ↓
2. Event: delivery.assigned → RabbitMQ
   ↓
3. Delivery status updates: ASSIGNED → PICKED_UP → OUT_FOR_DELIVERY
   ↓
4. Events: delivery.status.updated → RabbitMQ
   ↓
5. Notification Service sends delivery updates
   ↓
6. Delivery status: DELIVERED
   ↓
7. Events: delivery.status.updated, order.status.updated → RabbitMQ
   ↓
8. Order status: PREPARING → DELIVERED
   ↓
9. Notification Service sends "Order Delivered" notification
```

## Data Flow

### Read-Heavy Operations (Restaurant Listing)
```
Client Request
    ↓
Restaurant Service
    ↓
Redis Cache (check first)
    ↓
[Cache Hit] → Return cached data
[Cache Miss] → PostgreSQL → Cache result → Return data
```

### Write Operations (Order Creation)
```
Client Request
    ↓
Order Service
    ↓
Validate with Restaurant Service (HTTP)
    ↓
PostgreSQL (write order)
    ↓
Publish event to RabbitMQ
    ↓
Notification Service (async processing)
```

## Scalability Considerations

### Independent Scaling
- Each service can be scaled independently based on load
- Restaurant Service: Scale horizontally for read traffic
- Order Service: Scale for order processing
- Delivery Service: Scale for delivery tracking
- Notification Service: Scale for notification throughput

### Database Scaling
- Each service has its own database
- Can scale databases independently
- Read replicas can be added for read-heavy services

### Caching Strategy
- Redis caching reduces database load for restaurant listings
- Cache invalidation on data updates
- Configurable TTL for different data types

## Fault Tolerance

### Message Queue Resilience
- RabbitMQ ensures message delivery even if services are temporarily down
- Messages are persisted and durable
- Services can process messages when they come back online

### Service Isolation
- Service failures don't cascade
- Each service can operate independently
- Graceful degradation possible

### Database Resilience
- Separate databases prevent single point of failure
- Can implement database replication for high availability

## Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Databases**: PostgreSQL 15
- **Cache**: Redis 7
- **Message Queue**: RabbitMQ 3
- **Containerization**: Docker & Docker Compose

## Future Enhancements

1. **API Gateway**: Centralized routing and authentication
2. **Service Discovery**: Dynamic service registration
3. **Load Balancing**: Distribute traffic across service instances
4. **Monitoring & Logging**: Centralized logging (ELK stack)
5. **Distributed Tracing**: Track requests across services
6. **Circuit Breaker**: Prevent cascading failures
7. **Rate Limiting**: Protect services from overload
8. **Authentication/Authorization**: User authentication service
9. **Payment Service**: Payment processing integration
10. **Analytics Service**: Business intelligence and reporting

