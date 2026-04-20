import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View, Alert } from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { FIREBASE_AUTH, FIREBASE_DB } from "../firebaseConfig";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
	const [hasSeenOnboarding, setHasSeenOnboarding] = useState(null);

	useEffect(() => {
		AsyncStorage.getItem('has_seen_onboarding').then(value => {
			setHasSeenOnboarding(value === 'true');
		});
	}, []);

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
							setAuthData(currentUser, profile, role);
							await AsyncStorage.setItem(`role_${currentUser.uid}`, role);

							setUserId(currentUser.uid);
							setEmail(profile.email || currentUser.email || "");
							setPhone(profile.phone || "");

							if (profile.name) {
								const nameParts = profile.name.split(" ");
								setFirstName(nameParts[0] || "");
								setLastName(nameParts.slice(1).join(" ") || "");
							} else {
								setFirstName(profile.firstName || "");
								setLastName(profile.lastName || "");
							}
						} else {
							// Check pending_role set by Google sign-in before auth state fired
							const pendingRole = await AsyncStorage.getItem('pending_role');
							await AsyncStorage.removeItem('pending_role');

							if (pendingRole === 'customer') {
								// Google sign-in explicitly requested customer — honour it
								// even if a driver profile exists for this UID
								setAuthData(currentUser, {
									email: currentUser.email,
									name: currentUser.displayName || "User",
								}, "customer");
								setUserId(currentUser.uid);
								setEmail(currentUser.email || "");
								const nameParts = (currentUser.displayName || "User").split(" ");
								setFirstName(nameParts[0] || "");
								setLastName(nameParts.slice(1).join(" ") || "");
							} else {
								// Check in "drivers"
								const driverRef = doc(FIREBASE_DB, "drivers", currentUser.uid);
								const driverSnap = await getDoc(driverRef);

								if (!mounted) return;

								if (driverSnap.exists()) {
									const profile = driverSnap.data();
									const role = profile.role || "driver";
									setAuthData(currentUser, profile, role);
									await AsyncStorage.setItem(`role_${currentUser.uid}`, role);
									setDriverProfile({ ...profile, uid: currentUser.uid });
								} else {
									setAuthData(currentUser, {
										email: currentUser.email,
										name: currentUser.displayName || "User"
									}, "customer");
								}
							}
						}
					} catch (error) {
						console.error("❌ Error fetching user role:", error.message);

						if (error.code === "permission-denied") {
							Alert.alert(
								"Setup Required",
								"Your account was created successfully, but the app cannot load your profile due to database security settings.\n\nPlease contact support.",
								[{ text: "OK" }]
							);
						}

						if (!mounted) return;

						// Use cached role so drivers don't get misrouted on transient network errors
						const cachedRole = await AsyncStorage.getItem(`role_${currentUser.uid}`);
						const fallbackRole = cachedRole || "customer";

						const fallbackProfile = {
							email: currentUser.email || "",
							name: currentUser.displayName || "User",
							phone: currentUser.phoneNumber || "",
							uid: currentUser.uid,
						};

						setAuthData(currentUser, fallbackProfile, fallbackRole);
						setUserId(currentUser.uid);
						setEmail(currentUser.email || "");
						setPhone(currentUser.phoneNumber || "");

						const nameParts = (currentUser.displayName || "User").split(" ");
						setFirstName(nameParts[0] || "User");
						setLastName(nameParts.slice(1).join(" ") || "");
					} finally {
						setRoleLoading(false);
					}
				} else if (!currentUser) {
					if (mounted) {
						setAuthData(null, null, null);
					}
					// No need to clear cached role — it remains valid for next login
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

	if (initializing || (user && !storeRole && roleLoading) || hasSeenOnboarding === null) {
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
						{!hasSeenOnboarding && <Stack.Screen name="OnBoarding" component={OnBoarding} />}
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
