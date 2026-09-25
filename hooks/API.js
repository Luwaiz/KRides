import { API_URL, DEV_API_URL } from "@env";

const FALLBACK_URL = "https://krides.olaoluwaeyeclinic.com/api";

const url =
	__DEV__ && DEV_API_URL ? DEV_API_URL : API_URL || DEV_API_URL || FALLBACK_URL;

console.log("Effective API base URL:", url);

export const BASE_URL = url;

export default {
	Register: `${url}/auth/register`,
	Login: `${url}/auth/login`,
	UserProfile: `${url}/auth/user-profile`,
	UpdateProfile: `${url}/auth/editUserProfile`,
	DeleteProfile: `${url}/auth/deleteUserProfile`,
	LogOut: `${url}/auth/logout`,
	ChangePassword: `${url}/forgot-password`,
	verifyEmail: `${url}/email/verify`,
	emailStatus: `${url}/email/verification-status`,
	RegisterDriver: `${url}/auth/driver/register`,
	DriverProfile: `${url}/auth/driver/profile`,
	DriverLogin: `${url}/auth/driver/login`,
	ListOfRiders: `${url}/auth/driver-list`,
	CreateRide: `${url}/auth/trips/create`,
	RideHistory: `${url}/auth/trips/user_history`,
	DriverSummary: `${url}/auth/trips/daily-summary`,

	PendingRides: `${url}/auth/driver/trips`,
	AcceptRide: `${url}/auth/trips`,
};
