# KRides

A Nigerian campus ride-hailing app built with React Native (Expo), Firebase, and
Flutterwave.

## Getting started

```bash
npm install
npm start        # start the Expo dev server
```

## Credentials & secrets

None of the app's credentials are committed to this repository. Before you can
build or run the app you must provide the following locally.

### 1. Environment variables (`.env`)

Copy the template and fill in real values:

```bash
cp .env.example .env
```

The Firebase values come from **Firebase Console → Project Settings → General →
Your apps**. Maps/Flutterwave/Cloudinary values come from their respective
dashboards. See the comments in `.env.example` for each variable.

For **EAS builds**, these are injected from the `env` blocks in `eas.json`,
which reference [EAS Secrets](https://docs.expo.dev/build-reference/variables/)
(e.g. `$FIREBASE_API_KEY`). Create them with:

```bash
eas secret:create --scope project --name FIREBASE_API_KEY --value <value>
# ...repeat for each secret referenced in eas.json
```

### 2. Firebase client config files (gitignored)

`google-services.json` (Android) and `GoogleService-Info.plist` (iOS) are
**not** committed — they hold client OAuth client IDs and API keys. They are
referenced by `app.json` (`android.googleServicesFile` /
`ios.googleServicesFile`), so a build **will fail** without them.

- **Local:** download both from **Firebase Console → Project Settings → Your
  apps** and place them in the project root.
- **EAS:** upload them as file secrets so cloud builds can find them:

  ```bash
  eas secret:create --scope project --name GOOGLE_SERVICES_JSON \
    --type file --value ./google-services.json
  eas secret:create --scope project --name GOOGLE_SERVICE_INFO_PLIST \
    --type file --value ./GoogleService-Info.plist
  ```

  Then point `app.json`/`app.config.js` at the secret paths via
  `process.env.GOOGLE_SERVICES_JSON` (Android) and
  `process.env.GOOGLE_SERVICE_INFO_PLIST` (iOS).

### 3. Notification server

The push-notification / payments backend lives in `notification-server/`. It has
its own `.env` (see `notification-server/.env.example`) and a Firebase Admin SDK
service-account JSON that is **never** committed. See that folder's setup notes.

## Project layout

```
KRides/
  components/    UI components
  screens/       screen-level components (grouped by flow)
  helpers/       shared logic / utilities
  hooks/         services (API, Firebase) and React hooks
  constants/     theme and config values
  navigation/    React Navigation stacks
  notification-server/  Express backend for push + payments
```
