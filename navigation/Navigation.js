import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View } from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { FIREBASE_AUTH, FIREBASE_DB } from "../firebaseConfig";
import useAuthStore, {
	useUserDetails,
	useDriverDetails,
} from "../constants/Store"; // Import stores

// Screens and Navigators
import OnBoarding from "../screens/OnBoarding";
import AuthStack from "./AuthStack";
import DrawerNavigator from "./DrawerNavigator"; // for customers (with drawer)
import DriverDrawer from "./DriverDrawer"; // for drivers (with drawer)

const Stack = createNativeStackNavigator();

const Navigation = () => {
	const [initializing, setInitializing] = useState(true);
	const [user, setUser] = useState(null);
	const [roleLoading, setRoleLoading] = useState(false);

	// Get role from Zustand store instead of local state
	const storeRole = useAuthStore((state) => state.role);
	const setAuthData = useAuthStore((state) => state.setAuthData);

	// Get setters from useUserDetails store
	const { setFirstName, setLastName, setEmail, setPhone, setUserId } =
		useUserDetails((state) => ({
			setFirstName: state.setFirstName,
			setLastName: state.setLastName,
			setEmail: state.setEmail,
			setPhone: state.setPhone,
			setUserId: state.setUserId,
		}));

	// Get setter from useDriverDetails store
	const { setDriverProfile } = useDriverDetails((state) => ({
		setDriverProfile: state.setDriverProfile,
	}));

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(
			FIREBASE_AUTH,
			async (currentUser) => {
				setUser(currentUser);

				if (currentUser && !storeRole) {
					setRoleLoading(true);
					try {
						// First check if user exists in "users" collection
						const userRef = doc(FIREBASE_DB, "users", currentUser.uid);
						const userSnap = await getDoc(userRef);

						if (userSnap.exists()) {
							const profile = userSnap.data();
							const role = profile.role || "customer";
							setAuthData(currentUser, profile, role);

							// Populate useUserDetails store for customers
							console.log(
								"✅ Populating customer details in useUserDetails store:",
								profile
							);
							setUserId(currentUser.uid);
							setEmail(profile.email || currentUser.email || "");
							setPhone(profile.phone || "");

							// Handle name - could be 'name' or split into firstName/lastName
							if (profile.name) {
								const nameParts = profile.name.split(" ");
								setFirstName(nameParts[0] || "");
								setLastName(nameParts.slice(1).join(" ") || "");
							} else {
								setFirstName(profile.firstName || "");
								setLastName(profile.lastName || "");
							}
						} else {
							// Otherwise check in "drivers"
							const driverRef = doc(FIREBASE_DB, "drivers", currentUser.uid);
							const driverSnap = await getDoc(driverRef);

							if (driverSnap.exists()) {
								const profile = driverSnap.data();
								const role = profile.role || "driver";
								setAuthData(currentUser, profile, role);

								// Populate useDriverDetails store for drivers
								console.log(
									"✅ Populating driver details in useDriverDetails store:",
									profile
								);
								setDriverProfile({
									...profile,
									uid: currentUser.uid,
								});
							} else {
								setAuthData(currentUser, null, "customer"); // fallback
							}
						}
					} catch (error) {
						console.error("Error fetching user role:", error);
						setAuthData(currentUser, null, "customer");
					} finally {
						setRoleLoading(false);
					}
				} else if (!currentUser) {
					setAuthData(null, null, null);
				}

				setInitializing(false);
			}
		);

		return unsubscribe;
	}, [storeRole]);

	if (initializing || (user && !storeRole && roleLoading)) {
		return (
			<View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
				<ActivityIndicator size="large" color="#007bff" />
			</View>
		);
	}

	return (
		<NavigationContainer>
			<Stack.Navigator screenOptions={{ headerShown: false }}>
				{/* If user not logged in */}
				{!user ? (
					<>
						<Stack.Screen name="OnBoarding" component={OnBoarding} />
						<Stack.Screen name="AuthStack" component={AuthStack} />
					</>
				) : storeRole === "driver" ? (
					// Driver logged in - use key to force remount when role changes
					<Stack.Screen
						key="driver-drawer"
						name="DriverDrawer"
						component={DriverDrawer}
					/>
				) : (
					// Customer logged in - use key to force remount when role changes
					<Stack.Screen
						key="customer-drawer"
						name="AppStack"
						component={DrawerNavigator}
					/>
				)}
			</Stack.Navigator>
		</NavigationContainer>
	);
};

export default Navigation;
