from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import random
import hashlib
import base64
import json
import requests

app = Flask(__name__)
CORS(app)

# Simple token generation (for demo - use proper JWT library in production)
def generate_token(user_id):
    payload = {'userId': user_id, 'timestamp': int(datetime.now().timestamp() * 1000)}
    return base64.b64encode(json.dumps(payload).encode()).decode()

def verify_token(token):
    try:
        payload = json.loads(base64.b64decode(token.encode()).decode())
        return payload
    except:
        return None

# User storage (in-memory)
users = []

# In-memory databases (for simplicity)
restaurants = []
menu_items = []
orders = []
deliveries = []
notifications = []

# Mock delivery partners
MOCK_PARTNERS = [
    {'id': 'DP001', 'name': 'John Doe', 'phone': '+1234567890', 'available': True},
    {'id': 'DP002', 'name': 'Jane Smith', 'phone': '+1234567891', 'available': True},
    {'id': 'DP003', 'name': 'Mike Johnson', 'phone': '+1234567892', 'available': True},
]

order_id_counter = 1
delivery_id_counter = 1
notification_id_counter = 1

# Helper functions
def send_notification(user_id, notif_type, title, message, order_id, status):
    notification = {
        'id': f'NOTIF-{notification_id_counter}',
        'userId': user_id,
        'type': notif_type,
        'title': title,
        'message': message,
        'orderId': order_id,
        'status': status,
        'timestamp': datetime.now().isoformat()
    }
    notifications.append(notification)
    notification_id_counter += 1
    print(f'[NOTIFICATION] {title}: {message}')
    return notification

def assign_delivery_partner(order_id):
    partner = random.choice(MOCK_PARTNERS)
    delivery_id = f'DEL-{delivery_id_counter}'
    delivery_id_counter += 1
    
    estimated_time = datetime.now()
    estimated_time = estimated_time.replace(minute=estimated_time.minute + 30 + random.randint(0, 15))
    
    delivery = {
        'id': delivery_id,
        'deliveryId': delivery_id,
        'orderId': order_id,
        'partnerId': partner['id'],
        'partnerName': partner['name'],
        'partnerPhone': partner['phone'],
        'status': 'ASSIGNED',
        'estimatedDeliveryTime': estimated_time.isoformat(),
        'createdAt': datetime.now().isoformat()
    }
    deliveries.append(delivery)
    
    send_notification('user', 'DELIVERY_ASSIGNED', 'Delivery Partner Assigned',
        f'Your order {order_id} has been assigned to {partner["name"]}. Estimated delivery: {estimated_time.strftime("%I:%M %p")}',
        order_id, 'OUT_FOR_DELIVERY')
    
    return delivery

# AUTHENTICATION API

@app.route('/api/auth/register', methods=['POST'])
def register():
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')
        name = data.get('name')
        phone = data.get('phone', '')
        
        if not email or not password or not name:
            return jsonify({'error': 'Email, password, and name are required'}), 400
        
        # Check if user already exists locally
        existing_user = next((u for u in users if u['email'] == email), None)
        if existing_user:
            return jsonify({'error': 'User with this email already exists'}), 400
        
        # Check if user exists on Backend1 (Node.js)
        try:
            backend1_response = requests.post('http://localhost:3001/api/auth/register', 
                json={'email': email, 'password': password, 'name': name, 'phone': phone},
                timeout=2)
            if backend1_response.status_code == 201:
                # User was registered on Backend1, sync to local storage
                backend1_user = backend1_response.json()['user']
                users.append({
                    'id': backend1_user['id'],
                    'email': backend1_user['email'],
                    'password': hashlib.sha256(password.encode()).hexdigest(),
                    'name': backend1_user['name'],
                    'phone': backend1_user.get('phone', ''),
                    'createdAt': datetime.now().isoformat()
                })
                return jsonify(backend1_response.json()), 201
        except requests.exceptions.RequestException:
            # If Backend1 is unavailable, continue with local registration
            pass
        
        # Create new user locally
        user_id = f'USER-{int(datetime.now().timestamp() * 1000)}-{random.randint(1000, 9999)}'
        hashed_password = hashlib.sha256(password.encode()).hexdigest()
        
        user = {
            'id': user_id,
            'email': email,
            'password': hashed_password,
            'name': name,
            'phone': phone,
            'createdAt': datetime.now().isoformat()
        }
        
        users.append(user)
        
        # Sync to Backend1 (non-blocking)
        try:
            requests.post('http://localhost:3001/api/auth/register',
                json={'email': email, 'password': password, 'name': name, 'phone': phone},
                timeout=1)
        except:
            # Silently fail if Backend1 is unavailable
            pass
        
        # Generate token
        token = generate_token(user_id)
        
        return jsonify({
            'message': 'User registered successfully',
            'user': {
                'id': user['id'],
                'email': user['email'],
                'name': user['name'],
                'phone': user['phone']
            },
            'token': token
        }), 201
    except Exception as error:
        print(f'Error registering user: {error}')
        return jsonify({'error': 'Internal server error', 'message': str(error)}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400
        
        hashed_password = hashlib.sha256(password.encode()).hexdigest()
        user = next((u for u in users if u['email'] == email and u['password'] == hashed_password), None)
        
        # If user not found locally, check Backend1
        if not user:
            try:
                backend1_response = requests.post('http://localhost:3001/api/auth/login',
                    json={'email': email, 'password': password},
                    timeout=2)
                if backend1_response.status_code == 200:
                    # User exists on Backend1, sync to local storage
                    backend1_user = backend1_response.json()['user']
                    users.append({
                        'id': backend1_user['id'],
                        'email': backend1_user['email'],
                        'password': hashed_password,
                        'name': backend1_user['name'],
                        'phone': backend1_user.get('phone', ''),
                        'createdAt': datetime.now().isoformat()
                    })
                    return jsonify(backend1_response.json())
            except requests.exceptions.RequestException:
                pass
            
            return jsonify({'error': 'Invalid email or password'}), 401
        
        # Generate token
        token = generate_token(user['id'])
        
        return jsonify({
            'message': 'Login successful',
            'user': {
                'id': user['id'],
                'email': user['email'],
                'name': user['name'],
                'phone': user['phone']
            },
            'token': token
        })
    except Exception as error:
        print(f'Error logging in: {error}')
        return jsonify({'error': 'Internal server error', 'message': str(error)}), 500

@app.route('/api/auth/me', methods=['GET'])
def get_current_user():
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'No token provided'}), 401
        
        token = auth_header[7:]
        payload = verify_token(token)
        
        if not payload:
            return jsonify({'error': 'Invalid token'}), 401
        
        user = next((u for u in users if u['id'] == payload.get('userId')), None)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'id': user['id'],
            'email': user['email'],
            'name': user['name'],
            'phone': user['phone']
        })
    except Exception as error:
        print(f'Error getting user: {error}')
        return jsonify({'error': 'Internal server error'}), 500

# RESTAURANT API
@app.route('/api/restaurants', methods=['POST'])
def create_restaurant():
    try:
        data = request.json
        name = data.get('name')
        address = data.get('address')
        
        if not name or not address:
            return jsonify({'error': 'Name and address are required'}), 400
        
        restaurant = {
            'id': len(restaurants) + 1,
            'name': name,
            'cuisine': data.get('cuisine'),
            'address': address,
            'latitude': float(data.get('latitude', 0)),
            'longitude': float(data.get('longitude', 0)),
            'phone': data.get('phone'),
            'isActive': True,
            'createdAt': datetime.now().isoformat()
        }
        restaurants.append(restaurant)
        
        # Sync to Backend1 (non-blocking)
        try:
            requests.post('http://localhost:3001/api/restaurants',
                json={'name': name, 'cuisine': data.get('cuisine'), 'address': address,
                      'latitude': data.get('latitude', 0), 'longitude': data.get('longitude', 0),
                      'phone': data.get('phone')},
                timeout=1)
        except:
            # Silently fail if Backend1 is unavailable
            pass
        
        return jsonify(restaurant), 201
    except Exception as error:
        print(f'Error creating restaurant: {error}')
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/restaurants', methods=['GET'])
def get_restaurants():
    try:
        # Get restaurants from Backend1 and merge
        try:
            backend1_response = requests.get('http://localhost:3001/api/restaurants', timeout=2)
            backend1_restaurants = backend1_response.json() if backend1_response.status_code == 200 else []
            
            # Merge restaurants, avoiding duplicates by name+address
            merged_restaurants = list(restaurants)
            for backend1_rest in backend1_restaurants:
                exists = any(r['name'] == backend1_rest.get('name') and 
                           r['address'] == backend1_rest.get('address') 
                           for r in merged_restaurants)
                if not exists:
                    merged_restaurants.append(backend1_rest)
            
            return jsonify(merged_restaurants)
        except:
            # If Backend1 is unavailable, return local restaurants
            return jsonify(restaurants)
    except Exception as error:
        print(f'Error fetching restaurants: {error}')
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/restaurants/<int:restaurant_id>', methods=['GET'])
def get_restaurant(restaurant_id):
    restaurant = next((r for r in restaurants if r['id'] == restaurant_id), None)
    if not restaurant:
        return jsonify({'error': 'Restaurant not found'}), 404
    return jsonify(restaurant)

@app.route('/api/restaurants/<int:restaurant_id>/menu', methods=['GET'])
def get_restaurant_menu(restaurant_id):
    try:
        local_menu = [item for item in menu_items if item['restaurantId'] == restaurant_id]
        
        # Get menu items from Backend1 and merge
        try:
            backend1_response = requests.get(f'http://localhost:3001/api/restaurants/{restaurant_id}/menu', timeout=2)
            backend1_menu = backend1_response.json() if backend1_response.status_code == 200 else []
            
            # Merge menu items, avoiding duplicates by name+restaurantId
            merged_menu = list(local_menu)
            for backend1_item in backend1_menu:
                exists = any(m['name'] == backend1_item.get('name') and 
                           m['restaurantId'] == backend1_item.get('restaurantId')
                           for m in merged_menu)
                if not exists:
                    merged_menu.append(backend1_item)
            
            return jsonify(merged_menu)
        except:
            # If Backend1 is unavailable, return local menu
            return jsonify(local_menu)
    except Exception as error:
        print(f'Error fetching menu: {error}')
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/restaurants/<int:restaurant_id>/menu/items', methods=['POST'])
def create_menu_item(restaurant_id):
    try:
        data = request.json
        name = data.get('name')
        price = data.get('price')
        
        if not name or not price:
            return jsonify({'error': 'Name and price are required'}), 400
        
        menu_item = {
            'id': len(menu_items) + 1,
            'restaurantId': restaurant_id,
            'name': name,
            'description': data.get('description'),
            'price': float(price),
            'category': data.get('category', 'General'),
            'available': data.get('available', True),
            'createdAt': datetime.now().isoformat()
        }
        menu_items.append(menu_item)
        
        # Sync to Backend1 (non-blocking)
        try:
            requests.post(f'http://localhost:3001/api/restaurants/{restaurant_id}/menu/items',
                json={'name': name, 'description': data.get('description'), 'price': price,
                      'category': data.get('category', 'General'), 'available': data.get('available', True)},
                timeout=1)
        except:
            # Silently fail if Backend1 is unavailable
            pass
        
        return jsonify(menu_item), 201
    except Exception as error:
        print(f'Error creating menu item: {error}')
        return jsonify({'error': 'Internal server error'}), 500

# ORDER API
@app.route('/api/orders', methods=['POST'])
def create_order():
    global order_id_counter
    try:
        data = request.json
        user_id = data.get('userId')
        restaurant_id = data.get('restaurantId')
        items = data.get('items')
        delivery_address = data.get('deliveryAddress')
        
        if not user_id or not restaurant_id or not items or not delivery_address:
            return jsonify({'error': 'Missing required fields'}), 400
        
        restaurant = next((r for r in restaurants if r['id'] == int(restaurant_id) and r.get('isActive')), None)
        if not restaurant:
            return jsonify({'error': 'Restaurant not available'}), 400
        
        if not isinstance(items, list) or len(items) == 0:
            return jsonify({'error': 'Items array is required and cannot be empty'}), 400
        
        # Validate menu items
        validated_items = []
        for item in items:
            menu_item = next((m for m in menu_items 
                            if m['id'] == item.get('menuItemId') 
                            and m['restaurantId'] == int(restaurant_id)
                            and m.get('available')), None)
            if not menu_item:
                return jsonify({'error': f'Menu item {item.get("menuItemId")} not found or unavailable for restaurant {restaurant_id}'}), 400
            
            validated_items.append({
                **item,
                'menuItemName': menu_item['name'],
                'price': menu_item['price']
            })
        
        total_amount = sum(float(item['price']) * item['quantity'] for item in validated_items)
        
        order_id = f'ORD-{order_id_counter}'
        order_id_counter += 1
        
        order = {
            'orderId': order_id,
            'id': len(orders) + 1,
            'userId': user_id,
            'restaurantId': int(restaurant_id),
            'status': 'CREATED',
            'totalAmount': total_amount,
            'items': validated_items,
            'deliveryAddress': delivery_address,
            'deliveryLatitude': float(data.get('deliveryLatitude', 0)),
            'deliveryLongitude': float(data.get('deliveryLongitude', 0)),
            'createdAt': datetime.now().isoformat(),
            'updatedAt': datetime.now().isoformat()
        }
        orders.append(order)
        
        send_notification(user_id, 'ORDER_CREATED', 'Order Placed Successfully',
            f'Your order {order_id} has been placed. Total: ${total_amount:.2f}',
            order_id, 'CREATED')
        
        return jsonify(order), 201
    except Exception as error:
        print(f'Error creating order: {error}')
        return jsonify({'error': 'Internal server error', 'message': str(error)}), 500

@app.route('/api/orders', methods=['GET'])
def get_orders():
    return jsonify(orders)

@app.route('/api/orders/<order_id>', methods=['GET'])
def get_order(order_id):
    order = next((o for o in orders if o['orderId'] == order_id), None)
    if not order:
        return jsonify({'error': 'Order not found'}), 404
    return jsonify(order)

@app.route('/api/orders/<order_id>/restaurant-action', methods=['POST'])
def restaurant_action(order_id):
    data = request.json
    action = data.get('action')
    
    order = next((o for o in orders if o['orderId'] == order_id), None)
    if not order:
        return jsonify({'error': 'Order not found'}), 404
    
    if action == 'accept':
        order['status'] = 'CONFIRMED'
        send_notification(order['userId'], 'ORDER_CONFIRMED', 'Order Confirmed',
            f'Your order {order_id} has been confirmed by the restaurant.',
            order_id, 'CONFIRMED')
    elif action == 'reject':
        order['status'] = 'CANCELLED'
        send_notification(order['userId'], 'ORDER_CANCELLED', 'Order Cancelled',
            f'Your order {order_id} has been cancelled.',
            order_id, 'CANCELLED')
    
    order['updatedAt'] = datetime.now().isoformat()
    return jsonify(order)

@app.route('/api/orders/<order_id>/status', methods=['PATCH'])
def update_order_status(order_id):
    data = request.json
    status = data.get('status')
    
    order = next((o for o in orders if o['orderId'] == order_id), None)
    if not order:
        return jsonify({'error': 'Order not found'}), 404
    
    valid_statuses = ['CREATED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']
    if status not in valid_statuses:
        return jsonify({'error': 'Invalid status'}), 400
    
    order['status'] = status
    order['updatedAt'] = datetime.now().isoformat()
    
    if status == 'PREPARING':
        delivery = assign_delivery_partner(order_id)
        order['deliveryId'] = delivery['deliveryId']
        send_notification(order['userId'], 'ORDER_PREPARING', 'Order Being Prepared',
            f'Your order {order_id} is being prepared.',
            order_id, 'PREPARING')
    
    if status == 'OUT_FOR_DELIVERY':
        send_notification(order['userId'], 'ORDER_OUT_FOR_DELIVERY', 'Order Out for Delivery',
            f'Your order {order_id} is on the way!',
            order_id, 'OUT_FOR_DELIVERY')
    
    if status == 'DELIVERED':
        send_notification(order['userId'], 'ORDER_DELIVERED', 'Order Delivered',
            f'Your order {order_id} has been delivered. Enjoy your meal!',
            order_id, 'DELIVERED')
    
    return jsonify(order)

# DELIVERY API
@app.route('/api/deliveries', methods=['GET'])
def get_deliveries():
    return jsonify(deliveries)

@app.route('/api/deliveries/order/<order_id>', methods=['GET'])
def get_delivery_by_order(order_id):
    delivery = next((d for d in deliveries if d['orderId'] == order_id), None)
    if not delivery:
        return jsonify({'error': 'Delivery not found'}), 404
    return jsonify(delivery)

# NOTIFICATION API
@app.route('/api/notifications', methods=['GET'])
def get_notifications():
    return jsonify(notifications)

@app.route('/api/notifications/user/<user_id>', methods=['GET'])
def get_user_notifications(user_id):
    user_notifications = [n for n in notifications if n['userId'] == user_id]
    return jsonify(user_notifications)

# Root route
@app.route('/', methods=['GET'])
def root():
    return jsonify({
        'service': 'backend2-python-service',
        'language': 'Python',
        'status': 'running',
        'endpoints': '/api/restaurants, /api/orders, /api/notifications, /health'
    })

# Health check
@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'backend2-python-service', 'language': 'Python'})

if __name__ == '__main__':
    print('Backend 2 (Python Flask Service) starting on http://localhost:3002')
    print('Ready to receive requests from Load Balancer')
    app.run(host='0.0.0.0', port=3002, debug=True)

