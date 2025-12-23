# Microservices Architecture with Load Balancer

This project implements a **microservices architecture** with:
- **2 Backends in different languages** (Node.js and Python)
- **Load Balancer** for request distribution
- **Frontend** connected through load balancer

## Architecture

```
Frontend (Browser)
    ↓
Load Balancer (Port 3000) - Round-Robin Distribution
    ↓
    ├──→ Backend 1 (Node.js) - Port 3001
    └──→ Backend 2 (Python Flask) - Port 3002
```

## Services

### 1. Load Balancer (Node.js)
- **Port**: 3000
- **Purpose**: Distributes requests between backend services
- **Strategy**: Round-robin with health checks
- **File**: `load-balancer.js`

### 2. Backend 1 (Node.js/Express)
- **Port**: 3001
- **Language**: JavaScript/Node.js
- **Purpose**: Microservice handling restaurants, orders, notifications
- **File**: `backend1.js`

### 3. Backend 2 (Python/Flask)
- **Port**: 3002
- **Language**: Python
- **Purpose**: Microservice handling restaurants, orders, notifications
- **File**: `backend2.py`

## Installation

### Prerequisites
- Node.js 18+
- Python 3.11+
- pip (Python package manager)

### Setup

1. **Install Node.js dependencies:**
```bash
npm install
```

2. **Install Python dependencies:**
```bash
pip install -r requirements.txt
```

## Running the Application

### Option 1: Run All Services Together (Recommended)
```bash
npm run start:all
```

This will start:
- Backend 1 (Node.js) on http://localhost:3001
- Backend 2 (Python) on http://localhost:3002
- Load Balancer on http://localhost:3000

### Option 2: Run Services Separately

**Terminal 1** - Backend 1 (Node.js):
```bash
npm run start:backend1
```

**Terminal 2** - Backend 2 (Python):
```bash
npm run start:backend2
# OR
python backend2.py
```

**Terminal 3** - Load Balancer:
```bash
npm run start:loadbalancer
```

### Development Mode (with auto-reload)
```bash
npm run dev:all
```

## Access Points

- **Frontend**: http://localhost:3000
- **Load Balancer Health**: http://localhost:3000/health
- **Backend 1 Health**: http://localhost:3001/health
- **Backend 2 Health**: http://localhost:3002/health

## Load Balancer Features

1. **Round-Robin Distribution**: Alternates requests between backends
2. **Health Checks**: Monitors backend health every 5 seconds
3. **Automatic Failover**: Routes to healthy backends only
4. **Retry Logic**: Attempts next server if one fails

## Docker Deployment

### Build and Run with Docker Compose
```bash
docker-compose up --build
```

This will:
- Build all services
- Start load balancer on port 3000
- Start Backend 1 on port 3001
- Start Backend 2 on port 3002
- Set up networking between services

### Stop Services
```bash
docker-compose down
```

## How It Works

1. **Frontend** makes requests to `http://localhost:3000/api/*`
2. **Load Balancer** receives request and selects a backend (round-robin)
3. **Backend** (Node.js or Python) processes the request
4. **Load Balancer** returns response to frontend

### Request Flow Example

```
User Request → Load Balancer (3000)
    ↓
    ├─→ Backend 1 (Node.js) - Request 1, 3, 5...
    └─→ Backend 2 (Python) - Request 2, 4, 6...
```

## Health Monitoring

The load balancer automatically:
- Checks backend health every 5 seconds
- Removes unhealthy backends from rotation
- Re-adds backends when they become healthy again

View health status:
```bash
curl http://localhost:3000/health
```

## API Endpoints

All endpoints are available through the load balancer:

- `GET /api/restaurants` - List restaurants
- `POST /api/restaurants` - Create restaurant
- `GET /api/restaurants/:id` - Get restaurant
- `GET /api/restaurants/:id/menu` - Get menu
- `POST /api/restaurants/:id/menu/items` - Add menu item
- `POST /api/orders` - Create order
- `GET /api/orders` - List orders
- `GET /api/orders/:orderId` - Get order
- `PATCH /api/orders/:orderId/status` - Update order status
- `GET /api/notifications` - Get notifications

## Microservices Benefits

1. **Language Flexibility**: Use best language for each service
2. **Scalability**: Scale each service independently
3. **Fault Tolerance**: One service failure doesn't break entire system
4. **Load Distribution**: Requests spread across multiple backends
5. **Health Monitoring**: Automatic detection and routing around failures

## Notes

- Both backends share the same API structure for compatibility
- Data is stored in-memory (resets on restart)
- For production, use persistent databases for each service
- Load balancer uses round-robin by default (can be changed to weighted)

