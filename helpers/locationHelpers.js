
import { doc, setDoc } from "firebase/firestore";
import { FIREBASE_DB } from "../firebaseConfig";

export const addLocation = async (locationData) => {
	try {
		const id = locationData.name
			.toLowerCase()
			.replace(/\s+/g, "-")
			.replace(/[^a-z0-9-]/g, "");

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

export const updateLocation = async (locationId, updates) => {
	try {
		const locationRef = doc(FIREBASE_DB, "locations", locationId);

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

function generateSearchKeywords(name) {
	const words = name.toLowerCase().split(" ");
	const keywords = [];

	keywords.push(name.toLowerCase());

	words.forEach((word) => {
		if (word.length > 2) {
			keywords.push(word);
		}
	});

	words.forEach((word) => {
		for (let i = 3; i <= word.length; i++) {
			keywords.push(word.substring(0, i));
		}
	});

	return [...new Set(keywords)];
}

