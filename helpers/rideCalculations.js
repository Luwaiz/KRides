/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {Object} coord1 - {latitude, longitude}
 * @param {Object} coord2 - {latitude, longitude}
 * @returns {number} Distance in kilometers
 */
export const calculateDistance = (coord1, coord2) => {
	if (!coord1 || !coord2) return 0;

	const R = 6371; // Radius of Earth in kilometers
	const dLat = toRadians(coord2.latitude - coord1.latitude);
	const dLon = toRadians(coord2.longitude - coord1.longitude);

	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRadians(coord1.latitude)) *
			Math.cos(toRadians(coord2.latitude)) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2);

	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	const distance = R * c;

	return Math.round(distance * 100) / 100; // Round to 2 decimal places
};

/**
 * Convert degrees to radians
 */
const toRadians = (degrees) => {
	return degrees * (Math.PI / 180);
};

/**
 * Calculate estimated time based on distance
 * Average speed in Babcock University: 20 km/h (campus speed limits)
 * @param {number} distanceKm - Distance in kilometers
 * @returns {number} Estimated time in minutes
 */
export const calculateEstimatedTime = (distanceKm) => {
	if (!distanceKm || distanceKm === 0) return 0;

	const averageSpeedKmh = 20; // Campus speed
	const timeHours = distanceKm / averageSpeedKmh;
	const timeMinutes = Math.ceil(timeHours * 60);

	// Minimum 2 minutes for very short distances
	return Math.max(timeMinutes, 2);
};

/**
 * Format distance for display
 * @param {number} distanceKm - Distance in kilometers
 * @returns {string} Formatted distance string
 */
export const formatDistance = (distanceKm) => {
	if (!distanceKm || distanceKm === 0) return "0 km";

	if (distanceKm < 1) {
		const meters = Math.round(distanceKm * 1000);
		return `${meters} m`;
	}

	return `${distanceKm.toFixed(1)} km`;
};

/**
 * Format time for display
 * @param {number} minutes - Time in minutes
 * @returns {string} Formatted time string
 */
export const formatTime = (minutes) => {
	if (!minutes || minutes === 0) return "0 min";

	if (minutes < 60) {
		return `${minutes} min`;
	}

	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;

	if (remainingMinutes === 0) {
		return `${hours} hr`;
	}

	return `${hours} hr ${remainingMinutes} min`;
};

/**
 * Calculate ride fare based on distance and number of passengers
 * Base fare: ₦200 per passenger
 * Distance multiplier: Additional ₦50 per km beyond 1km
 * @param {number} distanceKm - Distance in kilometers
 * @param {number} passengers - Number of passengers
 * @returns {number} Total fare
 */
export const calculateFare = (distanceKm, passengers = 1) => {
	const baseFarePerPassenger = 200;
	const distanceRatePerKm = 50;
	const freeDistanceKm = 1;

	let fare = baseFarePerPassenger * passengers;

	// Add distance-based fare for distances beyond 1km
	if (distanceKm > freeDistanceKm) {
		const chargeableDistance = distanceKm - freeDistanceKm;
		fare += Math.ceil(chargeableDistance) * distanceRatePerKm;
	}

	return fare;
};
