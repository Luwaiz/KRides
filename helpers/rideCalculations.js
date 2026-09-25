import { getPricingConfig } from "../constants/pricingState";

export const calculateDistance = (coord1, coord2) => {
	if (!coord1 || !coord2) return 0;

	const R = 6371;
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

	return Math.round(distance * 100) / 100;
};

const toRadians = (degrees) => {
	return degrees * (Math.PI / 180);
};

export const calculateEstimatedTime = (distanceKm) => {
	if (!distanceKm || distanceKm === 0) return 0;

	const averageSpeedKmh = 20;
	const timeHours = distanceKm / averageSpeedKmh;
	const timeMinutes = Math.ceil(timeHours * 60);

	return Math.max(timeMinutes, 2);
};

export const formatDistance = (distanceKm) => {
	if (!distanceKm || distanceKm === 0) return "0 km";

	if (distanceKm < 1) {
		const meters = Math.round(distanceKm * 1000);
		return `${meters} m`;
	}

	return `${distanceKm.toFixed(1)} km`;
};

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

export const calculateFare = (distanceKm, passengers) => {
	const { baseFarePerPassenger, platformFeeStandard, platformFeeGroup, groupThreshold } = getPricingConfig();
	const fee = passengers >= groupThreshold ? platformFeeGroup : platformFeeStandard;
	return baseFarePerPassenger * passengers + fee;
};
