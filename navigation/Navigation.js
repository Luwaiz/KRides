import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View, Alert } from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { FIREBASE_AUTH, FIREBASE_DB } from "../firebaseConfig";
import useAuthStore, {
	useUserDetails,
	useDriverDetails,
} from "../constants/Store"; // Import stores
import notificationManager from "../helpers/notificationManager";

// Screens and Navigators
import OnBoarding from "../screens/OnBoarding";
import AuthStack from "./AuthStack";
import DrawerNavigator from "./DrawerNavigator"; // for customers (with drawer)
import DriverDrawer from "./DriverDrawer"; // for drivers (with drawer)
import DriverOnboardingStack from "./DriverOnboardingStack";

const Stack = createNativeStackNavigator();

const Navigation = () => {
	const [initializing, setInitializing] = useState(true);
	const [user, setUser] = useState(null);
	const [roleLoading, setRoleLoading] = useState(false);

	// Get role from Zustand store instead of local state
	const storeRole = useAuthStore((state) => state.role);
	const setAuthData = useAuthStore((state) => state.setAuthData);

	// Get setters from useUserDetails store
	const { setFirstName, setLastName, setEmail, setPhone, setUserId, setProfileImageUrl } =
		useUserDetails((state) => ({
			setFirstName: state.setFirstName,
			setLastName: state.setLastName,
			setEmail: state.setEmail,
			setPhone: state.setPhone,
			setUserId: state.setUserId,
			setProfileImageUrl: state.setProfileImageUrl,
		}));

	// Get setter from useDriverDetails store
	const { setDriverProfile } = useDriverDetails((state) => ({
		setDriverProfile: state.setDriverProfile,
	}));

	useEffect(() => {
		let mounted = true;

		const unsubscribe = onAuthStateChanged(
			FIREBASE_AUTH,
			async (currentUser) => {
				if (!mounted) return;

				setUser(currentUser);

				if (currentUser && !storeRole) {
					setRoleLoading(true);
					try {
						console.log("🔍 Fetching user profile for:", currentUser.uid);

						// First check if user exists in "users" collection
						const userRef = doc(FIREBASE_DB, "users", currentUser.uid);
						const userSnap = await getDoc(userRef);

						if (!mounted) return;

						if (userSnap.exists()) {
							const profile = userSnap.data();
							const role = profile.role || "customer";
							console.log("✅ Found customer profile:", profile);
							setAuthData(currentUser, profile, role);

							// Populate useUserDetails store for customers
							console.log(
								"✅ Populating customer details in useUserDetails store:",
								profile
							);
							setUserId(currentUser.uid);
							setEmail(profile.email || currentUser.email || "");
							setPhone(profile.phone || "");
							setProfileImageUrl(profile.profileImageUrl || profile.photoURL || null);

							// Handle name - could be 'name' or split into firstName/lastName
							if (profile.name) {
								const nameParts = profile.name.split(" ");
								setFirstName(nameParts[0] || "");
								setLastName(nameParts.slice(1).join(" ") || "");
							} else {
								setFirstName(profile.firstName || "");
								setLastName(profile.lastName || "");
							}

							// Initialize notifications for customer
							await notificationManager.initialize(currentUser.uid, role);
						} else {
							console.log("🔍 Not found in users, checking drivers...");
							// Otherwise check in "drivers"
							const driverRef = doc(FIREBASE_DB, "drivers", currentUser.uid);
							const driverSnap = await getDoc(driverRef);

							if (!mounted) return;

							if (driverSnap.exists()) {
								const profile = driverSnap.data();
								const role = profile.role || "driver";
								console.log("✅ Found driver profile:", profile);
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

								// Initialize notifications for driver
								await notificationManager.initialize(currentUser.uid, role);
							} else {
								console.log("⚠️ User not found in any collection, using defaults");
								setAuthData(currentUser, {
									email: currentUser.email,
									name: currentUser.displayName || "User"
								}, "customer"); // fallback
							}
						}
					} catch (error) {
						console.error("❌ Error fetching user role:", error);
						console.error("Error code:", error.code);
						console.error("Error message:", error.message);

						// Check if it's a Firestore permission error
						if (error.code === "permission-denied") {
							console.error("🚨 CRITICAL: Firestore permission denied!");
							console.error("This means Firestore security rules are blocking user profile access.");
							console.error("Please update Firestore rules in Firebase Console.");

							// Show detailed alert about Firestore rules
							Alert.alert(
								"Setup Required",
								"Your account was created successfully, but the app cannot load your profile due to database security settings.\n\nThis is a one-time setup issue that needs to be fixed in Firebase Console.\n\nPlease contact support or check the documentation (FIRESTORE_RULES_FIX.md) for instructions.",
								[{ text: "OK" }]
							);
						} else {
							// Alert user for other errors
							if (!__DEV__) {
								Alert.alert(
									"Connection Error",
									"Unable to load user data. Please check your internet connection and try again.",
									[{ text: "OK" }]
								);
							}
						}

						// Set comprehensive fallback data to prevent crashes
						if (!mounted) return;

						const fallbackProfile = {
							email: currentUser.email || "",
							name: currentUser.displayName || "User",
							phone: currentUser.phoneNumber || "",
							uid: currentUser.uid,
						};

						console.log("⚠️ Using fallback profile data:", fallbackProfile);

						// Set auth data
						setAuthData(currentUser, fallbackProfile, "customer");

						// Populate user details store with fallback data
						setUserId(currentUser.uid);
						setEmail(currentUser.email || "");
						setPhone(currentUser.phoneNumber || "");

						const nameParts = (currentUser.displayName || "User").split(" ");
						setFirstName(nameParts[0] || "User");
						setLastName(nameParts.slice(1).join(" ") || "");

						console.log("✅ Fallback profile data populated in stores");
					} finally {
						setRoleLoading(false);
					}
				} else if (!currentUser) {
					if (mounted) {
						// Cleanup notifications on logout
						const prevRole = useAuthStore.getState().role;
						const prevUser = useAuthStore.getState().user;
						if (prevUser?.uid && prevRole) {
							await notificationManager.cleanup(prevUser.uid, prevRole);
						}
						setAuthData(null, null, null);
					}
				}

				if (mounted) {
					setInitializing(false);
				}
			}
		);

		return () => {
			mounted = false;
			unsubscribe();
		};
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
					// Driver logged in
					// Check if bank details are verified
					useDriverDetails.getState().bankDetailsVerified ? (
						<Stack.Screen
							key="driver-drawer"
							name="DriverDrawer"
							component={DriverDrawer}
						/>
					) : (
						// If not verified, show onboarding stack
						<Stack.Screen
							key="driver-onboarding"
							name="DriverOnboardingStack"
							component={DriverOnboardingStack}
						/>
					)
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
