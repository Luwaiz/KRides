import Production from "./Production";
import { API_URL } from "@env";

const url = Production ? API_URL : "";

export default {
	//authentication API's
	Register: `${url}/auth/register`,
	Login: `${url}/auth/login`,
	UserProfile: `${url}/auth/user-profile`,
	UpdateProfile: `${url}/auth/editUserProfile`,
	DeleteProfile: `${url}/auth/deleteUserProfile`,
	LogOut: `${url}/auth/logout`,

	//DriverSignUp
	RegisterDriver: `${url}/auth/driver/register`,
	DriverProfile: `${url}/auth/driver/profile`,
	DriverLogin: `${url}/auth/driver/login`,
	//ride booking API's
	ListOfRiders: `${url}/auth/driver-list`,
	CreateRide: `${url}/auth/trips/create`,
    RideHistory : `${url}/auth/trips/user_history`
};
