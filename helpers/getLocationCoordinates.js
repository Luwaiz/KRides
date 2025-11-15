import { FIREBASE_DB } from "../firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";

/**
 * Get coordinates for a location by name from Firestore
 * @param {string} locationName - Name of the location
 * @returns {Promise<{latitude: number, longitude: number, name: string} | null>}
 */
export const getLocationCoordinates = async (locationName) => {
	if (!locationName) return null;

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
				latitude: data.coordinates.latitude,
				longitude: data.coordinates.longitude,
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
					latitude: data.coordinates.latitude,
					longitude: data.coordinates.longitude,
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
