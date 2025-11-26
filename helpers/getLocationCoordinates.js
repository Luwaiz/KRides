import { FIREBASE_DB } from "../firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";

/**
 * Get coordinates for a location by name from Firestore
 * @param {string|object} locationName - Name of the location or location object
 * @returns {Promise<{latitude: number, longitude: number, name: string} | null>}
 */
export const getLocationCoordinates = async (locationName) => {
	if (!locationName) return null;

	// If locationName is already an object with coordinates, return it
	if (typeof locationName === "object") {
		// Check if it already has coordinates
		if (locationName.latitude && locationName.longitude) {
			return {
				latitude: parseFloat(locationName.latitude),
				longitude: parseFloat(locationName.longitude),
				name: locationName.name || "Unknown",
				address: locationName.address || "",
			};
		}
		// If it's an object but only has a name property, extract the name
		if (locationName.name) {
			locationName = locationName.name;
		} else {
			console.warn("Invalid location object:", locationName);
			return null;
		}
	}

	// Ensure locationName is a string
	if (typeof locationName !== "string") {
		console.warn("Location name must be a string or object:", locationName);
		return null;
	}

	try {
		const locationsRef = collection(FIREBASE_DB, "locations");
		const q = query(
			locationsRef,
			where("name", "==", locationName),
			where("active", "==", true)
		);

		const querySnapshot = await getDocs(q);

		if (!querySnapshot.empty) {
			const doc = querySnapshot.docs[0];
			const data = doc.data();
			return {
				latitude: parseFloat(data.coordinates.latitude),
				longitude: parseFloat(data.coordinates.longitude),
				name: data.name,
				address: data.address,
			};
		}

		// If exact match not found, try searching by keyword
		const allLocations = await getDocs(
			query(locationsRef, where("active", "==", true))
		);

		for (const doc of allLocations.docs) {
			const data = doc.data();
			if (
				data.name.toLowerCase().includes(locationName.toLowerCase()) ||
				data.searchKeywords?.some((keyword) =>
					locationName.toLowerCase().includes(keyword)
				)
			) {
				return {
					latitude: parseFloat(data.coordinates.latitude),
					longitude: parseFloat(data.coordinates.longitude),
					name: data.name,
					address: data.address,
				};
			}
		}

		return null;
	} catch (error) {
		console.error("Error fetching location coordinates:", error);
		return null;
	}
};

/**
 * Get coordinates for both pickup and destination
 * @param {string} pickupName - Pickup location name
 * @param {string} destinationName - Destination location name
 * @returns {Promise<{pickup: object, destination: object}>}
 */
export const getRideCoordinates = async (pickupName, destinationName) => {
	try {
		const [pickup, destination] = await Promise.all([
			getLocationCoordinates(pickupName),
			getLocationCoordinates(destinationName),
		]);

		return { pickup, destination };
	} catch (error) {
		console.error("Error fetching ride coordinates:", error);
		return { pickup: null, destination: null };
	}
};
