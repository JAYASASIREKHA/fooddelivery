# Quick Start Guide - Microservices with Load Balancer

## 🚀 Quick Start

### 1. Install Dependencies

**Node.js dependencies:**
```bash
npm install
```

**Python dependencies:**
```bash
pip install -r requirements.txt
```

### 2. Start All Services

```bash
npm run start:all
```

This starts:
- ✅ Backend 1 (Node.js) on port 3001
- ✅ Backend 2 (Python) on port 3002  
- ✅ Load Balancer on port 3000

### 3. Access Application

- **Frontend**: http://localhost:3000
- **Load Balancer Health**: http://localhost:3000/health
- **Backend 1 Health**: http://localhost:3001/health
- **Backend 2 Health**: http://localhost:3002/health

## 📋 Architecture

```
Frontend → Load Balancer (3000) → Backend 1 (Node.js - 3001)
                                → Backend 2 (Python - 3002)
```

## 🔍 Verify Setup

1. Check load balancer health:
```bash
curl http://localhost:3000/health
```

2. Check backend services:
```bash
curl http://localhost:3001/health
curl http://localhost:3002/health
```

## 🐳 Docker Option

```bash
docker-compose up --build
```

## 📝 What's Different?

- **2 Backends**: Node.js and Python (different languages)
- **Load Balancer**: Distributes requests between backends
- **Microservices**: Each backend is independent
- **Health Checks**: Automatic monitoring and failover

## 🎯 Features

- ✅ Round-robin load balancing
- ✅ Automatic health monitoring
- ✅ Failover to healthy backends
- ✅ Same API across both backends
- ✅ Frontend connected through load balancer

