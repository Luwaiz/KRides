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
} from "../constants/Store";

import OnBoarding from "../screens/OnBoarding";
import AuthStack from "./AuthStack";
import AppStackNavigator from "./AppStack";
import DriverDrawer from "./DriverDrawer";

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

	useEffect(() => {
		let mounted = true;

		const unsubscribe = onAuthStateChanged(
			FIREBASE_AUTH,
			async (currentUser) => {
				if (!mounted) return;

				setUser(currentUser);

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
									const profile = driverSnap.data();
									setDriverProfile({ ...profile, uid: currentUser.uid });
									setAuthData(currentUser, profile, "driver");
									AsyncStorage.setItem(`role_${currentUser.uid}`, "driver").catch(() => {});
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
								} else if (pendingRole !== 'driver') {
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
							{hasSeenOnboarding === false && <Stack.Screen name="OnBoarding" component={OnBoarding} />}
							<Stack.Screen name="AuthStack" component={AuthStack} />
						</>
					) : storeRole === "driver" ? (
						<Stack.Screen
							key="driver-drawer"
							name="DriverDrawer"
							component={DriverDrawer}
						/>
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
