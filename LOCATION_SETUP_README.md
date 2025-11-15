# Location Picker Setup - Quick Start

## ✅ Implementation Complete!

The location picker system has been integrated into your app. Here's what was done:

### Files Modified:

1. **`components/WhereTo.js`** - Customer pickup/destination selection
2. **`components/Destination.js`** - Generic destination component
3. **`scripts/upload_locations.js`** - Ready to upload sample locations

### Files Created:

1. **`components/LocationPicker.js`** - Full-featured location picker modal
2. **`docs/location_picker_guide.md`** - Detailed documentation

## 🚀 Quick Start - Upload Locations

### Step 1: Install Firebase (if not already installed)

```bash
npm install firebase
```

### Step 2: Upload Sample Locations to Firestore

```bash
cd scripts
node upload_locations.js
```

You should see:

```
Starting location upload...
✓ Uploaded: Babcock Main Gate
✓ Uploaded: Senate Building
✓ Uploaded: University Library
...
✅ All locations uploaded successfully!
```

### Step 3: Test the App

1. Run your app
2. On the customer home screen, tap "Choose Pickup Location"
3. You should see the location picker with search functionality

## 📍 Sample Locations Included

The upload script includes these Babcock University locations:

- Main Gate
- Senate Building
- University Library
- Babcock Chapel
- Hostel Zone A & B
- University Cafeteria
- Sports Complex
- Ilishan Market
- Sagamu Interchange

## ✏️ Customizing Locations

Edit `scripts/upload_locations.js` to add/modify locations:

```javascript
{
  id: "unique-id",
  name: "Location Name",
  type: "landmark", // landmark, building, residential, food, recreation, market, transport
  coordinates: {
    latitude: 6.8935,  // Update with real GPS coordinates
    longitude: 3.723
  },
  address: "Full address here",
  category: "campus-entrance", // For grouping/filtering
  popular: true // Shows in "Popular Locations" by default
}
```

### Getting Real GPS Coordinates:

1. Open Google Maps
2. Right-click on the location
3. Click on the coordinates to copy them
4. First number = Latitude, Second = Longitude

## 🔍 Features Now Available

✅ **Search Functionality** - Search by name, address, or category
✅ **Popular Locations** - Quick access to frequently used spots
✅ **Real-time Filtering** - Results update as you type
✅ **Map Integration** - Selected locations include GPS coordinates
✅ **Clean UI** - Modern, user-friendly interface

## 📱 How It Works

### For Customers:

1. Tap "Choose Pickup Location" → Opens location picker
2. Search or select from popular locations
3. Tap "Choose Destination" → Opens destination picker
4. Continue to book ride with selected locations

### For Drivers:

- Ride requests display the location names
- Can be extended to show on map

## 🔐 Firestore Security Rules

Add these rules in Firebase Console → Firestore → Rules:

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

## 🛠️ Troubleshooting

### "No locations found"

- Make sure you ran the upload script successfully
- Check Firebase Console → Firestore → locations collection
- Verify `active: true` on location documents

### Search not working

- Ensure `searchKeywords` array exists on documents
- The upload script generates these automatically

### Locations not showing on map

- Verify coordinates are correct (latitude, longitude format)
- Check MainPage.js is using the `useRideDetailsStore` coordinates

## 📚 Next Steps

1. **Add More Locations**: Edit `scripts/upload_locations.js` and re-run
2. **Customize UI**: Modify `components/LocationPicker.js` styles
3. **Add Categories**: Group locations by type (academic, residential, etc.)
4. **Enable Admin Panel**: Create a screen to add/edit locations from the app

## 🎯 What's Integrated

### Customer Flow (WhereTo.js):

- Tap pickup → LocationPicker opens
- Select location → Stored in both:
  - `useRideStore` (name for display)
  - `useRideDetailsStore` (coordinates for map)
- Map automatically shows markers for pickup and destination

### Component Props:

```javascript
<LocationPicker
	visible={true} // Show/hide modal
	onClose={() => {}} // Close handler
	onSelectLocation={(loc) => {
		// Selection handler
		// loc = { name, latitude, longitude, address, id }
	}}
	title="Select Location" // Modal title
	showPopularOnly={false} // Filter to popular only
/>
```

## ✨ Done!

Your location picker is ready to use. Users can now search and select locations instead of typing them manually!
