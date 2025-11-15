# Location Picker Setup Guide

## Step 1: Upload Locations to Firestore

1. **Update Firebase credentials** in `scripts/upload_locations.js`:

   ```javascript
   const firebaseConfig = {
   	apiKey: "YOUR_API_KEY",
   	authDomain: "YOUR_AUTH_DOMAIN",
   	projectId: "YOUR_PROJECT_ID",
   	// ... rest of your config
   };
   ```

2. **Add real coordinates** for your locations. Replace the sample coordinates with actual GPS coordinates.

3. **Install Firebase dependencies** (if running from Node.js):

   ```bash
   npm install firebase
   ```

4. **Run the upload script**:
   ```bash
   node scripts/upload_locations.js
   ```

## Step 2: Use LocationPicker Component

### Basic Usage Example:

```javascript
import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import LocationPicker from "../components/LocationPicker";

const MyScreen = () => {
	const [showPicker, setShowPicker] = useState(false);
	const [selectedLocation, setSelectedLocation] = useState(null);

	const handleSelectLocation = (location) => {
		setSelectedLocation(location);
		console.log("Selected:", location);
	};

	return (
		<View style={styles.container}>
			<TouchableOpacity
				style={styles.button}
				onPress={() => setShowPicker(true)}
			>
				<Text style={styles.buttonText}>
					{selectedLocation ? selectedLocation.name : "Select Location"}
				</Text>
			</TouchableOpacity>

			<LocationPicker
				visible={showPicker}
				onClose={() => setShowPicker(false)}
				onSelectLocation={handleSelectLocation}
				title="Choose Pickup Location"
				showPopularOnly={false}
			/>
		</View>
	);
};
```

### Props:

- `visible` (boolean): Show/hide the picker
- `onClose` (function): Called when user closes the picker
- `onSelectLocation` (function): Called when user selects a location
  - Returns: `{ name, latitude, longitude, address, id }`
- `title` (string): Header title (default: "Select Location")
- `showPopularOnly` (boolean): Show only popular locations (default: false)

## Step 3: Firestore Security Rules

Add these rules to your Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /locations/{locationId} {
      // Anyone can read active locations
      allow read: if resource.data.active == true;

      // Only authenticated users can write
      allow write: if request.auth != null;
    }
  }
}
```

## Location Data Structure

Each location document should have:

```javascript
{
  id: "unique-id",
  name: "Location Name",
  type: "landmark" | "building" | "residential" | "food" | "recreation" | "market" | "transport",
  coordinates: {
    latitude: 6.8935,
    longitude: 3.723
  },
  address: "Full address",
  category: "campus-entrance" | "academic" | "accommodation" | "dining" | "sports" | "shopping" | "transport",
  popular: true | false,
  active: true | false,
  searchKeywords: ["keyword1", "keyword2"], // Auto-generated
  createdAt: "2025-01-01T00:00:00.000Z"
}
```

## Adding More Locations

You can add more locations programmatically or through Firebase Console:

```javascript
import { doc, setDoc } from "firebase/firestore";
import { FIREBASE_DB } from "./firebaseConfig";

const addLocation = async () => {
	const locationRef = doc(FIREBASE_DB, "locations", "new-location-id");
	await setDoc(locationRef, {
		name: "New Location",
		type: "landmark",
		coordinates: { latitude: 6.894, longitude: 3.723 },
		address: "Address here",
		category: "general",
		popular: false,
		active: true,
		searchKeywords: ["new", "location", "new location"],
		createdAt: new Date().toISOString(),
	});
};
```

## Search Features

The LocationPicker supports:

- ✅ Name search
- ✅ Address search
- ✅ Category search
- ✅ Partial word matching
- ✅ Popular locations filtering
- ✅ Real-time filtering as you type

## Customization

You can customize the appearance by modifying the styles in `LocationPicker.js`:

- Colors
- Fonts
- Icon sizes
- Layout spacing
