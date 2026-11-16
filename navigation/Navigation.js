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
	useActiveRideStore,
	useAcceptedRideStore,
	useRideStore,
	useRideDetailsStore,
	useBottomTabStore,
	useDriverAvailability,
} from "../constants/Store";

// Ride and screen state isn't tied to an account, so wipe it on sign-out; otherwise the
// next person to sign in on this phone would inherit the previous one's ride.
function clearSessionState() {
	useActiveRideStore.getState().clearActiveRide();
	useAcceptedRideStore.getState().clearAcceptedRide();
	useAcceptedRideStore.getState().clearNextRide();
	useRideStore.getState().clearRide();
	useRideDetailsStore.getState().resetRideDetails();
	// A signed-out session must not leave a driver's verified status behind.
	useDriverDetails.getState().clearDriver();
	useBottomTabStore.getState().setHomePage();
	useBottomTabStore.getState().setDriverHome();
	useDriverAvailability.getState().setOffline();
}

import OnBoarding from "../screens/OnBoarding";
import AuthStack from "./AuthStack";
import AppStackNavigator from "./AppStack";
import DriverDrawer from "./DriverDrawer";
import BankAccountDetails from "../screens/AuthScreens/BankAccountDetails";
import DriverProfileGate from "../components/DriverProfileGate";
import { getDriverScreen } from "./driverGate";
import { startPricingConfigListener } from "../constants/pricingConfig";

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

	const storeRole = useAuthStore((state) => state.role);

	// What a driver sees depends on their saved profile, so both of these come from the driver
	// store. getDriverScreen compares the uid so a previous account's data can never count.
	const driverUid = useDriverDetails((state) => state.uid);
	const bankDetailsVerified = useDriverDetails((state) => state.bankDetailsVerified);
	const driverScreen = getDriverScreen(user, driverUid, bankDetailsVerified);
	const setAuthData = useAuthStore((state) => state.setAuthData);

	const { setFirstName, setLastName, setEmail, setPhone, setUserId } =
		useUserDetails((state) => ({
			setFirstName: state.setFirstName,
			setLastName: state.setLastName,
			setEmail: state.setEmail,
			setPhone: state.setPhone,
			setUserId: state.setUserId,
		}));

	const { setDriverProfile } = useDriverDetails((state) => ({
		setDriverProfile: state.setDriverProfile,
	}));

	// Prices are read from Firestore, which only signed-in users can do. Starting this when the
	// app launches (signed out) was refused and never retried, so the app kept the built-in
	// prices for the whole session. Start it once there is a user, stop it on sign-out.
	const signedInUid = user?.uid || null;
	useEffect(() => {
		if (!signedInUid) return;
		return startPricingConfigListener();
	}, [signedInUid]);

	useEffect(() => {
		let mounted = true;

		const unsubscribe = onAuthStateChanged(
			FIREBASE_AUTH,
			async (currentUser) => {
				if (!mounted) return;

				setUser(currentUser);

				// Anyone who has signed in is past onboarding. The flag is otherwise only saved
				// from the onboarding screen itself, so users who never went through it (signed
				// in on an older build, or restored a session) would see it after logging out.
				if (currentUser) {
					setHasSeenOnboarding(true);
					AsyncStorage.setItem('has_seen_onboarding', 'true').catch(() => {});
				}

				const currentRole = useAuthStore.getState().role;
				if (currentUser && !currentRole) {
					try {
						console.log("🔍 Fetching user profile for:", currentUser.uid);

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
							const pendingRoleRaw = await AsyncStorage.getItem('pending_role');
							await AsyncStorage.removeItem('pending_role');

							let pendingRole = null;
							if (pendingRoleRaw) {
								try {
									const parsed = JSON.parse(pendingRoleRaw);
									if (parsed?.expiresAt && Date.now() < parsed.expiresAt) {
										pendingRole = parsed.role;
									}
								} catch {
									pendingRole = pendingRoleRaw;
								}
							}

							if (pendingRole === 'customer') {
								const driverRef = doc(FIREBASE_DB, "drivers", currentUser.uid);
								const driverSnap = await getDoc(driverRef);

								if (!mounted) return;

								if (driverSnap.exists()) {
									// A driver account used customer Google sign-in. The sign-in screen
									// shows "use driver login" and signs out, so don't let it in here.
									console.log("ℹ️ Driver account used customer Google sign-in; waiting for sign-out");
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
								const driverRef = doc(FIREBASE_DB, "drivers", currentUser.uid);
								const driverSnap = await getDoc(driverRef);

								if (!mounted) return;

								if (driverSnap.exists()) {
									const profile = driverSnap.data();
									const role = "driver";
									setDriverProfile({ ...profile, uid: currentUser.uid });
									setAuthData(currentUser, profile, role);
									AsyncStorage.setItem(`role_${currentUser.uid}`, role).catch(() => {});
								} else if (pendingRole !== 'driver' && pendingRole !== 'signup' && !useAuthStore.getState().role) {
									// No profile yet usually means sign-up is still saving it, and the
									// sign-up screen sets the full profile itself once it has. Only
									// fall back to a bare customer if nothing else has set a role.
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
							Toast.show({
								type: 'tomatoToast',
								text1: 'Setup Required',
								text2: 'Account created, but profile loading is blocked by security settings. Please contact support.',
								position: 'top',
								visibilityTime: 6000,
							});
						}

						if (!mounted) return;

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
					clearSessionState();
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
	}, []);

	const showLoading = initializing || (user && !storeRole) || hasSeenOnboarding === null;

	return (
		<View style={{ flex: 1 }}>
			<NavigationContainer>
				<Stack.Navigator screenOptions={{ headerShown: false }}>
					{}
					{!user ? (
						<>
							{hasSeenOnboarding === false && (
								<Stack.Screen name="OnBoarding">
									{(props) => (
										<OnBoarding {...props} onFinish={() => setHasSeenOnboarding(true)} />
									)}
								</Stack.Screen>
							)}
							<Stack.Screen name="AuthStack" component={AuthStack} />
						</>
					) : storeRole === "driver" ? (
						// Drivers only reach the dashboard with verified bank details. Until the
						// profile has loaded we don't know, so nothing is shown but a loader.
						driverScreen === "loading" ? (
							<Stack.Screen
								key="driver-profile-gate"
								name="DriverProfileGate"
								component={DriverProfileGate}
							/>
						) : driverScreen === "bank" ? (
							<Stack.Screen
								key="driver-bank-setup"
								name="DriverBankSetup"
								component={BankAccountDetails}
								initialParams={{ required: true }}
								options={{ gestureEnabled: false }}
							/>
						) : (
							<Stack.Screen
								key="driver-drawer"
								name="DriverDrawer"
								component={DriverDrawer}
							/>
						)
					) : (
						<Stack.Screen
							key="customer-stack"
							name="AppStack"
							component={AppStackNavigator}
						/>
					)}
				</Stack.Navigator>
			</NavigationContainer>

			{}
			{showLoading && (
				<View style={[StyleSheet.absoluteFill, { justifyContent: "center", alignItems: "center", backgroundColor: 'white' }]}>
					<ActivityIndicator size="large" color="#007bff" />
				</View>
			)}
		</View>
	);
};

export default Navigation;
