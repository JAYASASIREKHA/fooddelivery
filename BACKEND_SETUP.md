# Two-Backend Architecture Setup

This project now uses a **2-backend architecture**:

## Architecture Overview

```
Frontend (Browser)
    ↓
Backend 1 (API Gateway) - Port 3000
    ↓
Backend 2 (Service Backend) - Port 3001
```

### Backend 1 (API Gateway)
- **Port**: 3000
- **Purpose**: 
  - Serves the frontend static files
  - Acts as API gateway/proxy
  - Routes all API requests to Backend 2
- **File**: `backend1.js`

### Backend 2 (Service Backend)
- **Port**: 3001
- **Purpose**:
  - Handles all business logic
  - Manages restaurants, orders, deliveries, notifications
  - Contains all API endpoints
- **File**: `backend2.js`

## Installation

1. Install dependencies:
```bash
npm install
```

## Running the Application

### Option 1: Run Both Backends Together (Recommended)
```bash
npm run start:both
```

This will start:
- Backend 2 on http://localhost:3001
- Backend 1 on http://localhost:3000

### Option 2: Run Backends Separately

**Terminal 1** - Start Backend 2 (Service Backend):
```bash
npm run start:backend2
```

**Terminal 2** - Start Backend 1 (API Gateway):
```bash
npm run start:backend1
```

### Development Mode (with auto-reload)

Run both backends in development mode:
```bash
npm run dev:both
```

Or run them separately:
```bash
# Terminal 1
npm run dev:backend2

# Terminal 2
npm run dev:backend1
```

## Accessing the Application

- **Frontend**: http://localhost:3000
- **Backend 1 Health Check**: http://localhost:3000/health
- **Backend 2 Health Check**: http://localhost:3001/health

## How It Works

1. **Frontend** makes requests to `http://localhost:3000/api/*`
2. **Backend 1** receives the request and proxies it to `http://localhost:3001/api/*`
3. **Backend 2** processes the request and returns the response
4. **Backend 1** forwards the response back to the frontend

## Environment Variables

You can customize the ports and URLs using environment variables:

```bash
# Backend 1
PORT=3000 BACKEND2_URL=http://localhost:3001 node backend1.js

# Backend 2
PORT=3001 node backend2.js
```

## API Endpoints

All API endpoints are handled by Backend 2 and accessed through Backend 1:

- `GET /api/restaurants` - List all restaurants
- `POST /api/restaurants` - Create a restaurant
- `GET /api/restaurants/:id` - Get restaurant details
- `GET /api/restaurants/:id/menu` - Get restaurant menu
- `POST /api/restaurants/:id/menu/items` - Add menu item
- `POST /api/orders` - Create an order
- `GET /api/orders` - List all orders
- `GET /api/orders/:orderId` - Get order details
- `PATCH /api/orders/:orderId/status` - Update order status
- `GET /api/notifications` - Get all notifications
- `GET /api/deliveries` - Get all deliveries

## Notes

- Backend 2 must be running before Backend 1 starts
- If Backend 2 is unavailable, Backend 1 will return a 500 error
- Both backends use in-memory storage (data resets on restart)

