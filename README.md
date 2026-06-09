# KRides — Campus Ride-Hailing App

<img width="390" height="844" alt="image" src="https://github.com/user-attachments/assets/830a75ef-4b59-4794-b695-e04396308fdd" />


KRides (Kampus Ride) is a mobile ride-hailing platform built for university campuses. Students request rides from verified campus drivers — think of it as a campus-scoped Bolt/Uber with wallet-based payments, real-time driver tracking, and in-app ratings.

The project consists of two parts: a **React Native / Expo** mobile app (iOS + Android) and an **Express.js notification server** that handles push notifications, payments, wallet operations, and driver reporting.

---

## Features

**For riders (students)**
- Request rides with pickup and destination selection via Google Maps
- View available drivers nearby in real time
- Track driver en route to pickup, with ETA and route visualization
- Pay via Flutterwave (card) or in-app wallet (top-up via virtual bank account)
- Rate and review drivers after each ride
- View ride history and receipts
- Report drivers directly from the app

**For drivers**
- Dedicated driver onboarding flow with profile and bank account setup
- Accept or decline incoming ride requests with fare preview
- Turn-by-turn navigation to pickup and destination
- Earnings dashboard with daily summaries
- Driver ratings and review history
- Configurable commission structure

**Shared**
- Firebase Authentication (email/password + Google Sign-In)
- Push notifications via Firebase Cloud Messaging (ride requests, driver arrival, ride completion)
- Onboarding carousel for first-time users
- Biometric login support
- OTP phone verification
- Responsive layout with device scaling

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile framework | React Native 0.76.9 + Expo SDK 52 |
| Navigation | React Navigation 6 (native stack + drawer) |
| State management | Zustand 4.5 |
| Authentication | Firebase Auth (email/password + Google Sign-In) |
| Database | Cloud Firestore |
| Maps & directions | Google Maps SDK + react-native-maps-directions |
| Payments | Flutterwave (card payments + wallet top-up) |
| Push notifications | Firebase Cloud Messaging via Firebase Admin SDK |
| Notification server | Express.js 4.x + Firebase Admin SDK |
| UI components | React Native Paper, Bottom Sheet, Reanimated |
| Error tracking | Sentry (production), ErrorBoundary (client) |
| Build system | EAS (Expo Application Services) |

---

## Project Structure

```
KRides/
├── App.js                    # Root component — providers, navigation, error boundary
├── index.js                  # App entry point
├── firebaseConfig.js         # Firebase initialization with env var validation
│
├── screens/
│   ├── AuthScreens/          # Login, Signup, DriverLogin, DriverSignUp, OTP, etc.
│   ├── AppScreens/           # Rider screens — MainPage (map), History, Wallet, etc.
│   ├── DriverScreens/        # Driver screens — HomePage, Earnings, Reviews, Settings
│   ├── OnBoarding.js         # First-time onboarding carousel
│   └── SplashScreen.js       # Animated splash screen
│
├── components/
│   ├── buttons/              # ActiveButton, BackButton, BiometricButton, GoogleButton, etc.
│   ├── modals/               # RideConfirm, RatingModal, ReportDriverModal, Arrival, etc.
│   ├── homeHeader/           # Context-aware headers for each ride state
│   ├── DriverHeader/         # Driver-specific headers (Home, AcceptRide)
│   ├── DriversModal/         # Driver-specific bottom sheet tabs
│   ├── AvailableRiders.js    # Nearby driver cards
│   ├── ConfirmRide.js        # Ride confirmation panel
│   ├── Destination.js        # Destination selection UI
│   ├── LocationPicker.js     # Reusable map-based location picker
│   ├── WhereTo.js            # Search bar for destination input
│   ├── StarRating.js         # Star rating component
│   ├── RideStatusBar.js      # Real-time ride status indicator
│   ├── HistoryCard.js        # Ride history list item
│   ├── DrawerComponent.js    # Rider drawer menu
│   ├── DriverDrawerComponent.js  # Driver drawer menu
│   ├── ErrorBoundary.js      # React error boundary with fallback UI
│   └── ToastConfig.js        # Custom toast notification styles
│
├── navigation/
│   ├── Navigation.js         # Root navigator — auth state listener, role-based routing
│   ├── AuthStack.js          # Auth flow (Login → Signup → OTP → etc.)
│   ├── AppStack.js           # Rider tab/stack navigator
│   ├── DrawerNavigator.js    # Rider drawer wrapper
│   ├── DriverStack.js        # Driver screen stack
│   ├── DriverDrawer.js       # Driver drawer wrapper
│   ├── DriverOnboardingStack.js  # Driver registration flow
│   └── HomePageNav.js        # Home page sub-navigation
│
├── constants/
│   ├── Store.js              # Zustand stores (auth, user, driver, ride, UI state)
│   ├── styling.js            # Design tokens (colors, fonts, spacing)
│   ├── responsive.js         # Device scaling utilities
│   ├── commission.js         # Fare calculation and commission config
│   └── OnBoardData.jsx       # Onboarding carousel slide data
│
├── helpers/
│   ├── firebaseRides.js      # Firestore ride CRUD operations
│   ├── rideCalculations.js   # Fare estimation, distance/duration pricing
│   ├── walletHelpers.js      # Wallet balance, top-up, and payment logic
│   ├── driverEarnings.js     # Driver earnings and payout calculations
│   ├── driverRatings.js      # Rating aggregation and display
│   ├── driverStats.js        # Driver statistics (total rides, acceptance rate)
│   ├── locationHelpers.js    # Geocoding and location utilities
│   ├── getLocationCoordinates.js  # Coordinate extraction helpers
│   ├── pushNotifications.js  # FCM token registration and notification setup
│   ├── notificationHelpers.js    # Notification formatting and routing
│   ├── notificationManager.js    # Notification lifecycle management
│   ├── flutterwaveRefund.js  # Refund request handling
│   ├── authRateLimiter.js    # Client-side auth attempt throttling
│   └── Notify.jsx            # In-app notification component
│
├── hooks/
│   ├── API.js                # API endpoint URL map
│   ├── Firebase.js           # Firebase helper functions (auth, Firestore, FCM)
│   ├── Production.js         # Font loading and splash screen management
│   └── useGoogleAuth.js      # Google Sign-In hook
│
├── notification-server/      # Express.js backend (deployed separately)
│   ├── server.js             # Entry point — routes, middleware, FCM setup
│   ├── emailservice.js       # Email delivery (Nodemailer)
│   └── package.json          # Server dependencies
│
├── assets/
│   ├── fonts/                # AlbertSans font family + Poppins
│   ├── images/               # Raster assets (PNGs)
│   └── svg/                  # Vector assets (SVGs via react-native-svg-transformer)
│
├── docs/                     # Integration guides
│   ├── firebase_auth_integration.md
│   └── location_picker_guide.md
│
├── __tests__/                # Test files
├── patches/                  # patch-package fixes for RN dependencies
├── scripts/                  # Utility scripts (migration, env validation, etc.)
│
├── app.json                  # Expo app configuration
├── app.config.js             # Dynamic Expo config
├── eas.json                  # EAS Build profiles
├── babel.config.js           # Babel configuration
├── metro.config.js           # Metro bundler config (SVG transformer)
├── jest.config.js            # Jest test configuration
├── firebase.json             # Firebase project config
├── firestore.rules           # Firestore security rules
└── .env.example              # Environment variable template
```

---

## Getting Started

### Prerequisites

- Node.js >= 18
- Expo CLI (`npx expo`)
- EAS CLI (`npm install -g eas-cli`) for production builds
- A Firebase project with Authentication and Firestore enabled
- A Google Cloud project with Maps SDK for Android and iOS enabled
- A Flutterwave account (for payment processing)

### 1. Clone the repo

```bash
git clone https://github.com/Luwaiz/KRides.git
cd KRides
```

### 2. Install dependencies

```bash
# Mobile app
npm install

# Notification server
cd notification-server
npm install
cd ..
```

### 3. Configure environment variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Required variables:

| Variable | Description |
|---|---|
| `API_URL` | Production notification server URL |
| `DEV_API_URL` | Development notification server URL |
| `FIREBASE_API_KEY` | Firebase Web API key |
| `FIREBASE_AUTH_DOMAIN` | Firebase Auth domain |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `FIREBASE_MESSAGING_SENDER_ID` | Firebase Cloud Messaging sender ID |
| `FIREBASE_APP_ID` | Firebase app ID |
| `GOOGLE_MAPS_API_KEY` | Google Maps API key (restrict to your app's package name + SHA-1) |
| `FLUTTERWAVE_PUBLIC_KEY` | Flutterwave public key (safe for client) |
| `NOTIFICATION_API_KEY` | Shared secret for notification server auth |

For the notification server, create `notification-server/.env` with:

| Variable | Description |
|---|---|
| `PORT` | Server port (default: 3001) |
| `NOTIFICATION_API_KEY` | Must match the mobile app's value |
| `FIREBASE_ADMIN_SDK` | Base64-encoded Firebase service account JSON |
| `FLUTTERWAVE_SECRET_KEY` | Flutterwave secret key (server-side only — never in client) |
| `SMTP_EMAIL` | Email address for transactional emails |
| `SMTP_PASSWORD` | SMTP app password |

### 4. Set up Firebase

1. Place `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) in the project root.
2. Enable Email/Password and Google Sign-In providers in Firebase Console → Authentication.
3. Create Firestore collections: `users`, `drivers`, `trips`, `wallets`.
4. Deploy Firestore security rules: `firebase deploy --only firestore:rules`.

### 5. Run the app

```bash
# Start the Expo dev server
npx expo start --dev-client

# In a separate terminal, start the notification server (for local development)
cd notification-server
npm run dev
```

### 6. Build for production

```bash
# iOS
eas build --platform ios --profile production

# Android
eas build --platform android --profile production
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Mobile App                          │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐    │
│  │  Screens │  │Components│  │    Zustand Stores   │    │
│  │ (Rider / │  │ (Shared  │  │  Auth · User ·      │    │
│  │  Driver) │  │   UI)    │  │  Driver · Ride · UI │    │
│  └────┬─────┘  └──────────┘  └─────────┬──────────┘    │
│       │                                 │               │
│  ┌────▼─────────────────────────────────▼──────────┐    │
│  │              Firebase Client SDK                │    │
│  │     Auth  ·  Firestore  ·  Cloud Messaging      │    │
│  └────┬────────────────────────────────────────────┘    │
│       │                                                 │
│  ┌────▼────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ Google Maps │  │  Flutterwave │  │  Expo APIs   │   │
│  │   SDK       │  │  (Payments)  │  │ (Notifs,     │   │
│  │             │  │              │  │  Location,   │   │
│  │             │  │              │  │  Image)      │   │
│  └─────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────┬───────────────────────────────┘
                          │ HTTPS (x-api-key)
                          ▼
┌─────────────────────────────────────────────────────────┐
│               Notification Server (Express)             │
│                                                         │
│  Push Notifications · Wallet (Top-up / Pay) · Payments  │
│  Refunds · Ride Completion · Driver Reports · Email     │
│                                                         │
│  Firebase Admin SDK  ·  Flutterwave API  ·  Nodemailer  │
└─────────────────────────────────────────────────────────┘
```

**Data flow:** The mobile app reads and writes directly to Firestore for ride data, user profiles, and driver info. The notification server is called for operations that require server-side secrets (FCM push via Admin SDK, Flutterwave secret key for payments/refunds, webhook processing) and is authenticated via a shared API key in the `x-api-key` header.

---

## Notification Server Endpoints

All `/api/*` routes require the `x-api-key` header (except the Flutterwave webhook).

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/notifications/send` | Send push notification to a single user |
| `POST` | `/api/notifications/send-bulk` | Send push notification to multiple users |
| `POST` | `/api/notifications/notify-drivers` | Notify nearby drivers of a new ride request |
| `POST` | `/api/notifications/notify-driver-arrived` | Notify rider that driver has arrived |
| `POST` | `/api/notifications/ride-accepted` | Notify rider that a driver accepted their ride |
| `POST` | `/api/notifications/ride-completed` | Notify rider/driver of ride completion |
| `POST` | `/api/rides/rate` | Submit a ride rating |
| `POST` | `/api/payments/refund` | Initiate a Flutterwave refund |
| `GET` | `/api/payments/refund/:refundId` | Check refund status |
| `POST` | `/api/payments/create-subaccount` | Create a Flutterwave subaccount for a driver |
| `POST` | `/api/payments/complete-ride` | Process ride payment and commission split |
| `POST` | `/api/payments/wallet-refund` | Refund to rider's wallet |
| `POST` | `/api/wallet/create-topup-account` | Generate a virtual bank account for wallet top-up |
| `POST` | `/api/wallet/webhook` | Flutterwave webhook for wallet top-up confirmation |
| `POST` | `/api/wallet/pay-ride` | Pay for a ride from wallet balance |
| `POST` | `/api/auth/driver-email` | Send onboarding email to new driver |
| `POST` | `/api/reports/driver` | Submit a driver report |
| `GET` | `/health` | Health check |

---

## Key Design Decisions

**Role-based navigation:** The root navigator listens to Firebase `onAuthStateChanged` and reads the user's role from Firestore. Riders get the `AppStack` (with drawer), drivers get the `DriverDrawer` (with a separate screen stack). Unauthenticated users see the `AuthStack`. This keeps the navigation trees completely separate and avoids conditional rendering inside shared screens.

**Zustand over Context:** Global state is managed via Zustand stores (`useAuthStore`, `useUserDetails`, `useDriverDetails`, `useBottomTabStore`) rather than React Context. This avoids unnecessary re-renders from context propagation and keeps state updates granular.

**Firebase as the primary database:** Firestore handles users, drivers, trips, and wallets. The notification server doesn't own any data — it reads from and writes to the same Firestore instance via the Admin SDK. This means there's a single source of truth with no sync issues between client and server.

**Flutterwave split payments:** Ride payments use Flutterwave's subaccount system. Each driver has a subaccount, and ride payments are automatically split between the driver and the platform based on the commission percentage defined in `constants/commission.js`.

**Patch-package for RN fixes:** Two patches are maintained (`react-native+0.76.9.patch` and `react-native-screens+4.4.0.patch`) to work around upstream bugs. These are applied automatically via `postinstall`.

---

## Testing

```bash
# Run all tests
npx jest

# Run with coverage
npx jest --coverage

# Run a specific test file
npx jest helpers/__tests__/rideCalculations.test.js
```

Test files live alongside their source in `__tests__/` directories or in the root `__tests__/` folder.

---

## Deployment

**Mobile app** — Built and distributed via EAS:

```bash
# Development build (includes dev-client for debugging)
eas build --platform all --profile development

# Production build
eas build --platform all --profile production

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

**Notification server** — Deployed on Render as a web service. Set all environment variables (including `FIREBASE_ADMIN_SDK` as a base64-encoded JSON string) in the Render dashboard. The health check endpoint is `GET /health`.

---




## License

This project is proprietary. All rights reserved by the project owner.
