# KRides Notification Server

Standalone Node.js notification server for KRides with FCM (Firebase Cloud Messaging) and Expo Push Notification support.

## Features

- ✅ Dual notification delivery (FCM + Expo)
- ✅ RESTful API endpoints for all ride events
- ✅ Payment and refund confirmations
- ✅ Notification history in Firestore
- ✅ User notification preferences
- ✅ Easy local testing
- ✅ Production-ready

---

## Setup

### 1. Install Dependencies

```bash
cd notification-server
npm install
```

### 2. Configure Environment

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` and add your Firebase credentials:

```env
PORT=3001
NODE_ENV=development

# Firebase Configuration
FIREBASE_PROJECT_ID=kampusride
FIREBASE_CLIENT_EMAIL=your-service-account@kampusride.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
```

### 3. Get Firebase Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (kampusride)
3. Go to **Project Settings** → **Service Accounts**
4. Click **Generate New Private Key**
5. Download the JSON file
6. Copy the values to your `.env` file:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY`

---

## Running the Server

### Development Mode (with auto-reload)

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

The server will start on `http://localhost:3001`

---

## API Endpoints

### Health Check

```bash
GET /health
```

### Notification Endpoints

#### 1. Ride Booked (Payment Confirmation)

```bash
POST /api/notifications/ride-booked
Content-Type: application/json

{
  "customerId": "user123",
  "rideId": "ride456",
  "amount": 1500,
  "pickupLocation": "Main Gate",
  "destination": "Library"
}
```

#### 2. Ride Accepted

```bash
POST /api/notifications/ride-accepted
Content-Type: application/json

{
  "customerId": "user123",
  "rideId": "ride456",
  "driverName": "John Doe",
  "driverPhone": "08012345678"
}
```

#### 3. Driver Arrived

```bash
POST /api/notifications/driver-arrived
Content-Type: application/json

{
  "customerId": "user123",
  "rideId": "ride456",
  "driverName": "John Doe"
}
```

#### 4. Ride Started

```bash
POST /api/notifications/ride-started
Content-Type: application/json

{
  "customerId": "user123",
  "rideId": "ride456",
  "destination": "Library"
}
```

#### 5. Ride Completed

```bash
POST /api/notifications/ride-completed
Content-Type: application/json

{
  "customerId": "user123",
  "rideId": "ride456",
  "amount": 1500
}
```

#### 6. Ride Cancelled (Refund Confirmation)

```bash
POST /api/notifications/ride-cancelled
Content-Type: application/json

{
  "customerId": "user123",
  "rideId": "ride456",
  "refundAmount": 1500,
  "reason": "Driver unavailable"
}
```

#### 7. Send Custom Notification

```bash
POST /api/notifications/send-custom
Content-Type: application/json

{
  "userId": "user123",
  "title": "Special Offer!",
  "body": "Get 20% off your next ride",
  "data": {
    "type": "promotion",
    "code": "SAVE20"
  }
}
```

---

## Testing

### Using cURL

```bash
# Test health endpoint
curl http://localhost:3001/health

# Test ride booked notification
curl -X POST http://localhost:3001/api/notifications/ride-booked \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "JvsKRiFVPWasd82bUQgzTkUNE5e2",
    "rideId": "test123",
    "amount": 1500,
    "pickupLocation": "Main Gate",
    "destination": "Library"
  }'
```

### Using Postman

1. Import the API endpoints
2. Set base URL: `http://localhost:3001`
3. Test each endpoint with sample data

---

## Integration with KRides App

### When to Call Notification Endpoints

1. **After successful payment** → Call `/ride-booked`
2. **When driver accepts ride** → Call `/ride-accepted`
3. **When driver arrives at pickup** → Call `/driver-arrived`
4. **When ride starts** → Call `/ride-started`
5. **When ride completes** → Call `/ride-completed`
6. **When ride is cancelled** → Call `/ride-cancelled`

### Example Integration (React Native)

```javascript
import axios from 'axios';

const NOTIFICATION_SERVER = 'http://localhost:3001/api/notifications';

// After successful ride booking
async function notifyRideBooked(customerId, rideId, amount, pickup, destination) {
  try {
    await axios.post(`${NOTIFICATION_SERVER}/ride-booked`, {
      customerId,
      rideId,
      amount,
      pickupLocation: pickup,
      destination,
    });
  } catch (error) {
    console.error('Failed to send notification:', error);
  }
}
```

---

## Deployment

### Option 1: Deploy to Heroku

```bash
# Install Heroku CLI
# Login to Heroku
heroku login

# Create app
heroku create krides-notifications

# Set environment variables
heroku config:set FIREBASE_PROJECT_ID=kampusride
heroku config:set FIREBASE_CLIENT_EMAIL=your-email@kampusride.iam.gserviceaccount.com
heroku config:set FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."

# Deploy
git push heroku main
```

### Option 2: Deploy to Railway

1. Go to [Railway.app](https://railway.app/)
2. Create new project from GitHub repo
3. Add environment variables
4. Deploy automatically

### Option 3: Deploy to VPS (DigitalOcean, AWS, etc.)

```bash
# SSH into server
ssh user@your-server

# Clone repo
git clone your-repo
cd notification-server

# Install dependencies
npm install

# Install PM2 for process management
npm install -g pm2

# Start server with PM2
pm2 start server.js --name krides-notifications

# Save PM2 config
pm2 save
pm2 startup
```

---

## Firestore Structure

### User Document (Required Fields)

```javascript
{
  uid: "user123",
  role: "customer" | "driver",
  pushToken: "ExponentPushToken[...]",  // Expo token
  fcmToken: "FCM_TOKEN_HERE",           // FCM token
  notificationPreferences: {
    rideUpdates: true,
    promotions: false,
    messages: true
  }
}
```

### Notification History

```javascript
// Collection: notifications/{userId}/items/{notificationId}
{
  type: "ride_booked",
  rideId: "ride123",
  title: "Ride Booked Successfully!",
  body: "Payment of ₦1500 confirmed...",
  createdAt: Timestamp,
  read: false
}
```

---

## Troubleshooting

### Server won't start

- Check if port 3001 is available
- Verify Firebase credentials in `.env`
- Check for syntax errors in `.env` file

### Notifications not sending

- Verify user has valid push tokens in Firestore
- Check server logs for errors
- Ensure Firebase Admin SDK is initialized correctly

### FCM errors

- Verify FCM token format
- Check if token is expired (tokens expire after ~2 months)
- Ensure user has granted notification permissions

---

## Monitoring

### View Logs

```bash
# Development
npm run dev

# Production (with PM2)
pm2 logs krides-notifications

# Follow logs
pm2 logs krides-notifications --lines 100
```

---

## Security Notes

- ⚠️ Never commit `.env` file to version control
- ⚠️ Use HTTPS in production
- ⚠️ Add API authentication for production use
- ⚠️ Implement rate limiting to prevent abuse

---

## License

MIT
