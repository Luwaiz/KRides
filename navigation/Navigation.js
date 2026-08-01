import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View, Alert, StyleSheet } from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { FIREBASE_AUTH, FIREBASE_DB } from "../firebaseConfig";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import useAuthStore, {
	useUserDetails,
	useDriverDetails,
} from "../constants/Store"; // Import stores

// Screens and Navigators
import OnBoarding from "../screens/OnBoarding";
import AuthStack from "./AuthStack";
import AppStackNavigator from "./AppStack"; // for customers
import DriverDrawer from "./DriverDrawer"; // for drivers (with drawer)

const Stack = createNativeStackNavigator();

const Navigation = () => {
	const [initializing, setInitializing] = useState(true);
	const [user, setUser] = useState(null);
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

				// Read role directly from store to avoid stale closure when customer
				// signs out and driver signs in back-to-back in the same effect cycle.
				const currentRole = useAuthStore.getState().role;
				if (currentUser && !currentRole) {
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
							// Check pending_role set before auth state fired
							const pendingRoleRaw = await AsyncStorage.getItem('pending_role');
							await AsyncStorage.removeItem('pending_role');

							// Parse — support both legacy string format and new { role, expiresAt } format
							let pendingRole = null;
							if (pendingRoleRaw) {
								try {
									const parsed = JSON.parse(pendingRoleRaw);
									if (parsed?.expiresAt && Date.now() < parsed.expiresAt) {
										pendingRole = parsed.role;
									}
									// Expired — discard silently
								} catch {
									// Legacy plain-string value — honour it once, then it's gone
									pendingRole = pendingRoleRaw;
								}
							}

							if (pendingRole === 'customer') {
								// Google sign-in explicitly requested customer — but don't
								// honour that if this account is already registered as a
								// driver (e.g. the same Google account used for driver
								// signup, tapped from the customer Login/Signup screen).
								const driverRef = doc(FIREBASE_DB, "drivers", currentUser.uid);
								const driverSnap = await getDoc(driverRef);

								if (!mounted) return;

								if (driverSnap.exists()) {
									const profile = driverSnap.data();
									setAuthData(currentUser, profile, "driver");
									await AsyncStorage.setItem(`role_${currentUser.uid}`, "driver");
									setDriverProfile({ ...profile, uid: currentUser.uid });
								} else {
									setAuthData(currentUser, {
										email: currentUser.email,
										name: currentUser.displayName || "User",
									}, "customer");
									setUserId(currentUser.uid);
									setEmail(currentUser.email || "");
									const nameParts = (currentUser.displayName || "User").split(" ");
									setFirstName(nameParts[0] || "");
									setLastName(nameParts.slice(1).join(" ") || "");
								}
							} else {
								// pending_role='driver' (DriverLogin) OR unknown — check drivers first
								const driverRef = doc(FIREBASE_DB, "drivers", currentUser.uid);
								const driverSnap = await getDoc(driverRef);

								if (!mounted) return;

								if (driverSnap.exists()) {
									const profile = driverSnap.data();
									const role = "driver";
									setAuthData(currentUser, profile, role);
									await AsyncStorage.setItem(`role_${currentUser.uid}`, role);
									setDriverProfile({ ...profile, uid: currentUser.uid });
								} else if (pendingRole !== 'driver') {
									// Only fall back to customer if we weren't explicitly told it's a driver
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
							// Use Toast instead of Alert to avoid native presentation crashes during navigation transitions
							Toast.show({
								type: 'tomatoToast',
								text1: 'Setup Required',
								text2: 'Account created, but profile loading is blocked by security settings. Please contact support.',
								position: 'top',
								visibilityTime: 6000,
							});
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
					}
				} else if (!currentUser) {
					if (mounted) {
						setAuthData(null, null, null);
					}
					// Clear all cached role keys on logout so a shared device
					// starts fresh for the next user.
					AsyncStorage.getAllKeys()
						.then(keys => {
							const roleKeys = keys.filter(k => k.startsWith('role_'));
							if (roleKeys.length) AsyncStorage.multiRemove(roleKeys);
						})
						.catch(() => {});
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
	}, []); // No deps — onAuthStateChanged is persistent; role is read via getState() not closure

	// Determine if we should show the global loading overlay
	const showLoading = initializing || (user && !storeRole) || hasSeenOnboarding === null;

	return (
		<View style={{ flex: 1 }}>
			<NavigationContainer>
				<Stack.Navigator screenOptions={{ headerShown: false }}>
					{/* If user not logged in */}
					{!user ? (
						<>
							{hasSeenOnboarding === false && <Stack.Screen name="OnBoarding" component={OnBoarding} />}
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
							key="customer-stack"
							name="AppStack"
							component={AppStackNavigator}
						/>
					)}
				</Stack.Navigator>
			</NavigationContainer>

			{/* Global Loading Overlay — avoids unmounting NavigationContainer */}
			{showLoading && (
				<View style={[StyleSheet.absoluteFill, { justifyContent: "center", alignItems: "center", backgroundColor: 'white' }]}>
					<ActivityIndicator size="large" color="#007bff" />
				</View>
			)}
		</View>
	);
};

export default Navigation;
