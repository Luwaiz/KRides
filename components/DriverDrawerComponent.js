// components/DriverDrawerComponent.jsx
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, Switch, TouchableOpacity } from "react-native";
import { DrawerContentScrollView, DrawerItem } from "@react-navigation/drawer";
import {
	AntDesign,
	Foundation,
	Ionicons,
	MaterialIcons,
} from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import AvatarSvg from "../assets/svg/Frame 77avatar.svg";
import { colors } from "../constants/styling";
import Confirmation1 from "./modals/Confirmation1";
import useAuthStore, { useDriverDetails } from "../constants/Store";
import { FIREBASE_AUTH, FIREBASE_DB } from "../firebaseConfig";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { signOut } from "firebase/auth";

// --- Drawer items list for driver (unique name) ---
const driverDetails = [
	{
		icon: <AntDesign name="clockcircle" size={25} color={colors.IconGrey} />,
		title: "Ride history",
		navigateTo: "History",
	},
	{
		icon: <MaterialIcons name="stars" size={24} color={colors.IconGrey} />,
		title: "Rating & Reviews",
		navigateTo: "Rating",
	},
	{
		icon: <AntDesign name="questioncircle" size={24} color={colors.IconGrey} />,
		title: "Support",
		navigateTo: "Support",
	},
	{
		icon: <Foundation name="info" size={30} color={colors.IconGrey} />,
		title: "About",
		navigateTo: "About",
	},
	{
		icon: <Ionicons name="log-out-sharp" size={24} color={colors.IconGrey} />,
		title: "Logout",
	},
	{
		icon: <AntDesign name="delete" size={24} color={"red"} />,
		title: "Delete Account",
	},
];

const DriverDrawerItem = ({ icon, title, navigateTo }) => {
	const navigation = useNavigation();
	const [modal, setModal] = useState(false);

	const handleLogout = async () => {
		try {
			await signOut(FIREBASE_AUTH);
			navigation.replace("Login");
		} catch (err) {
			console.error("Logout error", err);
			alert("Failed to logout");
		}
	};

	const onPress = () => {
		if (title === "Logout") {
			setModal(true);
		} else if (title === "Delete Account") {
			setModal(true);
		} else if (navigateTo) {
			navigation.navigate(navigateTo);
		}
	};

	// handle the confirmation modal result using Confirmation1 (assumed it calls callbacks via props or similar)
	return (
		<>
			<DrawerItem
				labelStyle={title === "Delete Account" ? styles.label : null}
				style={styles.items}
				icon={() => icon}
				label={title}
				onPress={onPress}
			/>
			<Confirmation1
				modal={modal}
				setModal={setModal}
				title={title}
				onConfirm={async () => {
					if (title === "Logout") {
						try {
							await signOut(FIREBASE_AUTH);
							useDriverDetails.getState().clearDriver();
							useAuthStore.getState().clearAuth();
							navigation.replace("AuthStack");
						} catch (err) {
							console.error("Logout error:", err);
							alert("Failed to logout");
						}
					}

					if (title === "Delete Account") {
						alert("Driver delete account flow to implement");
					}
				}}
			/>
		</>
	);
};

const DriverDrawerComponent = (props) => {
	console.log("🚗 DriverDrawerComponent RENDERED - This is the DRIVER drawer!");

	const navigation = useNavigation();
	const { fullName, vehicle_id, rating, isOnline, setIsOnline } =
		useDriverDetails((s) => ({
			fullName: s.fullName,
			vehicle_id: s.vehicle_id,
			rating: s.rating,
			isOnline: s.isOnline,
			setIsOnline: s.setIsOnline,
		}));
	const { profile } = useAuthStore();

	// Keep the drawer in sync with the drivers/{uid} doc
	useEffect(() => {
		let uid;
		try {
			uid = FIREBASE_AUTH.currentUser ? FIREBASE_AUTH.currentUser.uid : null;
		} catch (e) {
			uid = null;
		}
		if (!uid) return;

		const driverDocRef = doc(FIREBASE_DB, "drivers", uid);
		const unsub = onSnapshot(
			driverDocRef,
			(snap) => {
				if (!snap.exists()) return;
				const data = snap.data();
				// update Zustand store directly
				const setDriverProfile = useDriverDetails.getState().setDriverProfile;
				if (setDriverProfile) setDriverProfile(data);
			},
			(error) => {
				// Silently handle permission-denied errors (happens during logout)
				if (error.code === "permission-denied") {
					console.log(
						"🔒 Permission denied in DriverDrawer - user likely logged out"
					);
				} else {
					console.error("❌ Error in DriverDrawer onSnapshot:", error);
				}
			}
		);

		return () => unsub && unsub();
	}, []);

	const toggleOnlineStatus = async () => {
		try {
			const newStatus = !isOnline;
			setIsOnline(newStatus);

			const driverLocationRef = doc(
				FIREBASE_DB,
				"driver_locations",
				FIREBASE_AUTH.currentUser.uid
			);
			await setDoc(
				driverLocationRef,
				{
					isOnline: newStatus,
					lastUpdated: serverTimestamp(),
				},
				{ merge: true }
			);
		} catch (error) {
			console.error("Error toggling online status:", error);
			// revert locally
			setIsOnline((prev) => !prev);
			alert("Failed to update online status");
		}
	};

	console.log("ssss", profile);
	return (
		<View style={{ flex: 1 }}>
			<DrawerContentScrollView {...props}>
				<TouchableOpacity onPress={() => navigation.navigate("Profile")}>
					<View style={styles.topCont}>
						<View style={styles.avatarContainer}>
							<AvatarSvg />
						</View>
						<View style={styles.infoContainer}>
							<Text style={styles.name}>{profile?.fullname || "Driver"}</Text>
							<Text style={styles.vehicleId}>
								Vehicle: {profile?.vehicle_id || "-"}
							</Text>
							<View style={styles.ratingContainer}>
								<AntDesign name="star" size={16} color="#FFD700" />
								<Text style={styles.rating}>
									{typeof rating === "number" ? rating.toFixed(1) : "-"}
								</Text>
							</View>
							<Text style={styles.editProfile}>Edit Profile</Text>
						</View>
					</View>
				</TouchableOpacity>

				<View style={styles.onlineStatusContainer}>
					<Text style={styles.onlineStatusText}>
						{isOnline ? "Online" : "Offline"}
					</Text>
					<Switch
						value={isOnline}
						onValueChange={toggleOnlineStatus}
						trackColor={{ false: "#767577", true: colors.primaryBlue }}
						thumbColor={isOnline ? "#fff" : "#f4f3f4"}
					/>
				</View>

				<View style={styles.bottomCont}>
					{driverDetails.map((d, i) => (
						<DriverDrawerItem
							key={i}
							icon={d.icon}
							title={d.title}
							navigateTo={d.navigateTo}
						/>
					))}
				</View>
			</DrawerContentScrollView>
		</View>
	);
};

export default DriverDrawerComponent;

const styles = StyleSheet.create({
	topCont: {
		flexDirection: "row",
		marginHorizontal: 15,
		paddingVertical: 15,
		gap: 16,
		borderBottomWidth: 1,
		borderBottomColor: colors.lightGrey,
		alignItems: "center",
	},
	avatarContainer: {
		/* optional style */
	},
	name: { fontFamily: "Albert-SemiBold", fontSize: 18, marginBottom: 4 },
	vehicleId: {
		fontFamily: "Albert-Regular",
		fontSize: 14,
		color: colors.textGrey,
		marginBottom: 4,
	},
	ratingContainer: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 4,
	},
	rating: { marginLeft: 4, fontFamily: "Albert-Regular", fontSize: 14 },
	editProfile: {
		fontFamily: "Albert-Light",
		color: colors.primaryBlue,
		fontSize: 14,
	},
	items: { margin: 0, padding: 0 },
	label: { color: "red" },
	bottomCont: {
		borderBottomWidth: 1,
		borderBottomColor: colors.lightGrey,
		marginHorizontal: 15,
	},
	onlineStatusContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 20,
		paddingVertical: 15,
		borderBottomWidth: 1,
		borderBottomColor: colors.lightGrey,
	},
	onlineStatusText: { fontFamily: "Albert-Regular", fontSize: 16 },
	infoContainer: { flex: 1 },
});
