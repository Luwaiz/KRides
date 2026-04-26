import { StyleSheet, Text, View, Image } from "react-native";
import { DrawerContentScrollView, DrawerItem } from "@react-navigation/drawer";
import React, { useEffect, useState, useRef } from "react";
import { AntDesign } from "@expo/vector-icons";
import { Foundation } from "@expo/vector-icons";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "../constants/styling";
import { useNavigation } from "@react-navigation/native";
import { TouchableOpacity } from "react-native-gesture-handler";
import Confirmation1 from "./modals/Confirmation1";
import Avatar from "../assets/svg/Frame 77avatar.svg";
import useAuthStore, { useUserDetails } from "../constants/Store";
import { doc, onSnapshot } from "firebase/firestore";
import { FIREBASE_AUTH, FIREBASE_DB } from "../firebaseConfig";
import { signOut } from "firebase/auth";

const details = [
	// {
	// 	icon: <AntDesign name="clockcircle" size={25} color={colors.IconGrey} />,
	// 	title: "Ride history",
	// 	navigateTo: "History",
	// },
	{
		icon: <MaterialCommunityIcons name="wallet-outline" size={24} color={colors.IconGrey} />,
		title: "Wallet",
		navigateTo: "Wallet",
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
const DrawerLayout = ({ icon, title, navigateTo }) => {
	const navigation = useNavigation();
	const [modal, setModal] = useState(false);
	return (
		<>
			<DrawerItem
				labelStyle={title === "Delete Account" && styles.label}
				style={styles.items}
				icon={() => icon}
				label={title}
				onPress={
					title === "Logout" || title === "Delete Account"
						? () => setModal(true)
						: () => navigation.navigate(navigateTo)
				}
			/>
			<Confirmation1
				modal={modal}
				setModal={setModal}
				title={title}
				onConfirm={async () => {
					if (title === "Logout") {
						try {
							await signOut(FIREBASE_AUTH);
							useUserDetails.getState().clearUser();
							useAuthStore.getState().clearAuth();
							navigation.replace("AuthStack");
						} catch (err) {
							console.error("Logout error:", err);
							alert("Failed to logout");
						}
					}
				}}
			/>
		</>
	);
};

const DrawerContent = (props) => {
	return details.map((item, i) => {
		return (
			<DrawerLayout
				key={i}
				title={item.title}
				navigateTo={item.navigateTo}
				icon={item.icon}
			/>
		);
	});
};

const DrawerComponent = (props) => {
	console.log("👤 DrawerComponent RENDERED - This is the CUSTOMER drawer!");

	const navigation = useNavigation();
	const [name, setName] = useState("Loading...");
	const [profileUrl, setProfileUrl] = useState(null);
	const [loading, setLoading] = useState(true);
	const listenerSetup = useRef(false);

	useEffect(() => {
		// Prevent duplicate listener setup
		if (listenerSetup.current) {
			console.log("⚠️ Listener already set up, skipping...");
			return;
		}

		const auth = FIREBASE_AUTH;
		const db = FIREBASE_DB;
		const user = auth.currentUser;

		console.log("🔍 DrawerComponent useEffect - Current user:", user?.uid);

		if (user) {
			console.log("📱 Setting up listener for customer profile:", user.uid);
			listenerSetup.current = true;

			// Set up real-time listener for customer profile
			const unsub = onSnapshot(
				doc(db, "users", user.uid),
				(docSnap) => {
					console.log("📄 Snapshot received. Exists?", docSnap.exists());

					if (docSnap.exists()) {
						const userData = docSnap.data();
						const displayName =
							userData?.name || userData?.fullname || "Customer";
						setName(displayName);
						setProfileUrl(userData?.profileUrl || null);
						console.log("✅ Customer profile loaded. Name:", displayName);
					} else {
						console.log("❌ No customer profile document found");
						setName("Customer");
						setProfileUrl(null);
					}
					setLoading(false);
				},
				(error) => {
					// Silently handle permission-denied errors (happens during logout)
					if (error.code === "permission-denied") {
						console.log("🔒 Permission denied - user likely logged out");
					} else {
						console.error("❌ Error in onSnapshot:", error);
					}
					setName("Customer");
					setProfileUrl(null);
					setLoading(false);
				}
			);

			// Cleanup listener on unmount
			return () => {
				console.log("🧹 Cleaning up DrawerComponent listener");
				listenerSetup.current = false;
				unsub();
			};
		} else {
			console.log("⚠️ No authenticated user in DrawerComponent");
			setName("No User");
			setLoading(false);
		}
	}, []); // Empty dependency array - only run once

	console.log("👤 DrawerComponent rendering with name:", name);
	return (
		<View style={{ flex: 1 }}>
			<DrawerContentScrollView {...props}>
				<TouchableOpacity onPress={() => navigation.navigate("Profile")}>
					<View style={styles.topCont}>
						<View>
							{profileUrl ? (
								<Image
									source={{ uri: profileUrl }}
									style={{ width: 50, height: 50, borderRadius: 25 }}
								/>
							) : (
								<Avatar width={50} height={50} />
							)}
						</View>
						<View style={styles.container}>
							<Text style={styles.title}>{loading ? "Loading..." : name}</Text>
							<Text style={styles.subTitle}>Edit Profile</Text>
						</View>
					</View>
				</TouchableOpacity>
				<View style={styles.bottomCont}><DrawerContent /></View>
			</DrawerContentScrollView>
		</View>
	);
};

export default DrawerComponent;

const styles = StyleSheet.create({
	topCont: {
		flexDirection: "row",
		marginHorizontal: 15,
		paddingVertical: 10,
		gap: 16,
		borderBottomWidth: 1,
		borderBottomColor: colors.lightGrey,
		alignItems: "center",
	},
	title: {
		fontFamily: "Albert-SemiBold",
		fontSize: 18,
		marginBottom: 5,
	},
	subTitle: {
		fontFamily: "Albert-Light",
		color: colors.primaryBlue,
		fontSize: 14,
	},
	items: {
		margin: 0,
		padding: 0,
		gap: 0,
	},
	label: {
		margin: 0,
		padding: 0,
		gap: 0,
		color: "red",
	},
	bottomCont: {
		borderBottomWidth: 1,
		borderBottomColor: colors.lightGrey,
		marginHorizontal: 15,
	},
});
