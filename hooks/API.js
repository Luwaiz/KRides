import { API_URL, DEV_API_URL } from "@env";

// Determine effective base URL:
// - If running in development and DEV_API_URL is provided, use it.
// - Otherwise, use API_URL from .env (this should be provided for release builds).
// - Fall back to a known production URL if neither is available.
const FALLBACK_URL = "https://krides.olaoluwaeyeclinic.com/api";

const url =
	__DEV__ && DEV_API_URL ? DEV_API_URL : API_URL || DEV_API_URL || FALLBACK_URL;

console.log("Effective API base URL:", url);

export const BASE_URL = url;

export default {
	//authentication API's
	Register: `${url}/auth/register`,
	Login: `${url}/auth/login`,
	UserProfile: `${url}/auth/user-profile`,
	UpdateProfile: `${url}/auth/editUserProfile`,
	DeleteProfile: `${url}/auth/deleteUserProfile`,
	LogOut: `${url}/auth/logout`,
	ChangePassword: `${url}/forgot-password`,
	verifyEmail: `${url}/email/verify`,
	emailStatus: `${url}/email/verification-status`,
	//DriverSignUp
	RegisterDriver: `${url}/auth/driver/register`,
	DriverProfile: `${url}/auth/driver/profile`,
	DriverLogin: `${url}/auth/driver/login`,
	//ride booking API's
	ListOfRiders: `${url}/auth/driver-list`,
	CreateRide: `${url}/auth/trips/create`,
	RideHistory: `${url}/auth/trips/user_history`,
	DriverSummary: `${url}/auth/trips/daily-summary`,

	PendingRides: `${url}/auth/driver/trips`,
	AcceptRide: `${url}/auth/trips`,
};
