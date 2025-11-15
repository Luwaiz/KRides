# Firebase Authentication & Security Rules — Integration Guide

This document shows how to migrate authentication to Firebase Auth and how clients should interact with Firestore using the security rules in `firestore.rules`.

Contents

- Setup & SDKs
- Recommended Firestore structure for `users`
- React Native sample: Sign up / Sign in & create user doc
- Register and store FCM tokens
- Best practices (App Check, callable functions)
- Deploying and testing rules

---

1. Setup & SDKs

- Create a Firebase project in the Firebase Console and enable Authentication (Email/Password and/or Phone). Enable Firestore and Cloud Functions.
- Install React Native Firebase packages (example using npm):

```powershell
npm install @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore @react-native-firebase/messaging
```

Follow platform setup instructions (Android: add google-services.json, iOS: GoogleService-Info.plist). See react-native-firebase docs.

2. Users collection shape

Collection: `users/{uid}`

Example document:

```
{
  uid: "uid123",
  name: "Eluwa Emmanuel",
  phone: "+234...",
  email: "emma@example.com",
  role: "customer" or "driver",
  vehicle_id: "VEH123", // only for drivers
  fcmTokens: { "token1": true, "token2": true },
  createdAt: FieldValue.serverTimestamp()
}
```

3. React Native: Sign up and create user doc

Example: Email/password signup and create the Firestore profile (using @react-native-firebase):

```javascript
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

async function signUpWithEmail({ email, password, name, phone, role }) {
	const credential = await auth().createUserWithEmailAndPassword(
		email,
		password
	);
	const uid = credential.user.uid;

	// Create a user doc in Firestore
	await firestore().collection("users").doc(uid).set({
		uid,
		name,
		email,
		phone,
		role, // 'customer' or 'driver'
		fcmTokens: {},
		createdAt: firestore.FieldValue.serverTimestamp(),
	});

	return credential.user;
}
```

Sign in example:

```javascript
async function signIn({ email, password }) {
	const credential = await auth().signInWithEmailAndPassword(email, password);
	return credential.user;
}
```

4. Register FCM token and store on user document

```javascript
import messaging from "@react-native-firebase/messaging";

async function registerFcmToken(uid) {
	const token = await messaging().getToken();
	if (!token) return null;
	const userRef = firestore().collection("users").doc(uid);
	await userRef.set({ fcmTokens: { [token]: true } }, { merge: true });
	return token;
}
```

Call `registerFcmToken` after sign-in and also on app start; remove tokens on sign-out.

5. Booking & Accept flow (client guidance)

- Booking: client writes to `rides` collection with `status: 'pending'` and `customerUid: auth().currentUser.uid`.
- Accept: client should call a Cloud Function `acceptRide(rideId)` (callable) which performs validation and a transaction to set `status: 'accepted'` and `assignedDriverUid`. Using a callable or server-side function prevents race conditions and avoids exposing logic to clients.

Example callable invocation from RN client:

```javascript
import functions from "@react-native-firebase/functions";

async function acceptRide(rideId) {
	const accept = functions().httpsCallable("acceptRide");
	const res = await accept({ rideId });
	return res.data;
}
```

6. Security & best practices

- Use the `firestore.rules` file included in repo as a starting point. It enforces:
  - customers can create their own rides,
  - drivers can only accept by assigning themselves and switching status pending->accepted,
  - only drivers can write their `driver_locations` document.
- Use Firebase App Check to prevent token abuse.
- Put state-changing operations (accept, cancel validations) inside Cloud Functions to keep rules simple and safe.
- Test rules thoroughly using the Firebase emulator suite before deploying.

7. Deploying rules and functions

Install Firebase CLI and login:

```powershell
npm install -g firebase-tools
firebase login
firebase init
```

When asked, enable Firestore rules and Cloud Functions. Copy `firestore.rules` into your `firestore.rules` file in the project and deploy:

```powershell
firebase deploy --only firestore:rules
```

Deploy functions after adding them to `functions/index.js`:

```powershell
firebase deploy --only functions
```

8. Testing locally with emulator

Use the Firebase emulator for auth, firestore and functions to run end-to-end locally:

```powershell
firebase emulators:start --only auth,firestore,functions
```

Your RN app can be pointed to the emulator during development (see react-native-firebase docs).

---

If you want, I can now:

- draft the `acceptRide` Cloud Function (callable) that performs the safe transaction, or
- add example Firestore rules unit tests using the Firebase emulator, or
- scaffold the RN client code changes (auth flows and FCM token registration) directly into your repo.

Which should I do next?
