/**
 * Helper function to add a single location to Firestore
 * Use this in your app to add locations programmatically
 */

import { doc, setDoc } from "firebase/firestore";
import { FIREBASE_DB } from "../firebaseConfig";

/**
 * Add a new location to Firestore
 * @param {Object} locationData - Location data
 * @param {string} locationData.name - Location name
 * @param {string} locationData.type - Type: landmark, building, residential, food, recreation, market, transport
 * @param {Object} locationData.coordinates - GPS coordinates
 * @param {number} locationData.coordinates.latitude - Latitude
 * @param {number} locationData.coordinates.longitude - Longitude
 * @param {string} locationData.address - Full address
 * @param {string} locationData.category - Category for filtering
 * @param {boolean} locationData.popular - Is this a popular location?
 * @returns {Promise<boolean>} Success status
 */
export const addLocation = async (locationData) => {
	try {
		// Generate ID from name (lowercase, replace spaces with hyphens)
		const id = locationData.name
			.toLowerCase()
			.replace(/\s+/g, "-")
			.replace(/[^a-z0-9-]/g, "");

		// Generate search keywords
		const searchKeywords = generateSearchKeywords(locationData.name);

		const locationRef = doc(FIREBASE_DB, "locations", id);

		await setDoc(locationRef, {
			id,
			name: locationData.name,
			type: locationData.type || "landmark",
			coordinates: locationData.coordinates,
			address: locationData.address,
			category: locationData.category || "general",
			popular: locationData.popular || false,
			active: true,
			searchKeywords,
			createdAt: new Date().toISOString(),
		});

		console.log(`✓ Location added: ${locationData.name}`);
		return true;
	} catch (error) {
		console.error("Error adding location:", error);
		return false;
	}
};

/**
 * Update an existing location
 */
export const updateLocation = async (locationId, updates) => {
	try {
		const locationRef = doc(FIREBASE_DB, "locations", locationId);

		// If name is updated, regenerate search keywords
		if (updates.name) {
			updates.searchKeywords = generateSearchKeywords(updates.name);
		}

		await setDoc(locationRef, updates, { merge: true });
		console.log(`✓ Location updated: ${locationId}`);
		return true;
	} catch (error) {
		console.error("Error updating location:", error);
		return false;
	}
};

/**
 * Delete a location (actually marks as inactive)
 */
export const deleteLocation = async (locationId) => {
	try {
		const locationRef = doc(FIREBASE_DB, "locations", locationId);
		await setDoc(locationRef, { active: false }, { merge: true });
		console.log(`✓ Location deactivated: ${locationId}`);
		return true;
	} catch (error) {
		console.error("Error deleting location:", error);
		return false;
	}
};

/**
 * Generate search keywords from location name
 * @private
 */
function generateSearchKeywords(name) {
	const words = name.toLowerCase().split(" ");
	const keywords = [];

	// Add full name
	keywords.push(name.toLowerCase());

	// Add individual words
	words.forEach((word) => {
		if (word.length > 2) {
			keywords.push(word);
		}
	});

	// Add partial matches (first 3+ characters)
	words.forEach((word) => {
		for (let i = 3; i <= word.length; i++) {
			keywords.push(word.substring(0, i));
		}
	});

	return [...new Set(keywords)]; // Remove duplicates
}

// Example usage:
/*
import { addLocation } from './helpers/locationHelpers';

// Add a new location
await addLocation({
  name: "Student Union Building",
  type: "building",
  coordinates: {
    latitude: 6.8947,
    longitude: 3.7237
  },
  address: "Babcock University Campus",
  category: "student-services",
  popular: true
});
*/
