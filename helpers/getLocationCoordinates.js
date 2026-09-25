import { FIREBASE_DB } from "../firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";

export const getLocationCoordinates = async (locationName) => {
	if (!locationName) return null;

	if (typeof locationName === "object") {
		if (locationName.latitude && locationName.longitude) {
			return {
				latitude: parseFloat(locationName.latitude),
				longitude: parseFloat(locationName.longitude),
				name: locationName.name || "Unknown",
				address: locationName.address || "",
			};
		}
		if (locationName.name) {
			locationName = locationName.name;
		} else {
			console.warn("Invalid location object:", locationName);
			return null;
		}
	}

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

		const allLocations = await getDocs(
			query(locationsRef, where("active", "==", true))
		);

		for (const doc of allLocations.docs) {
			const data = doc.data();
			if (
				data.name.toLowerCase().includes(locationName.toLowerCase()) ||
				data.searchKeywords?.some((keyword) =>
					locationName.toLowerCase().includes(keyword.toLowerCase()) ||
					keyword.toLowerCase().includes(locationName.toLowerCase())
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

		console.warn(`No location found matching "${locationName}"`);
		return null;
	} catch (error) {
		console.error("Error fetching location coordinates (network/backend):", error);
		return null;
	}
};

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
