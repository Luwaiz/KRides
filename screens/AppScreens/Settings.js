import { Pressable, StyleSheet, Text, View, Image } from "react-native";
import React, { useEffect, useState } from "react";
import useAuthStore, { useUserDetails } from "../../constants/Store";
import Avatar from "../../assets/svg/Frame 91profile.svg";
import Entypo from "@expo/vector-icons/Entypo";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Foundation from "@expo/vector-icons/Foundation";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../constants/styling";
import Confirmation1 from "../../components/modals/Confirmation1";
import { FIREBASE_AUTH, FIREBASE_DB } from "../../firebaseConfig";
import { doc, onSnapshot } from "firebase/firestore";

const Settings = ({ navigation }) => {
	const [modal, setModal] = useState(false);
	const [name, setName] = useState("");
	const [profileUrl, setProfileUrl] = useState(null);
	const [loading, setLoading] = useState(false);

	const { user } = useAuthStore((state) => ({
		user: state.user,
	}));
	const [modalTitle, setModalTitle] = useState("");

	const openModal = (title) => {
		setModalTitle(title);
		setModal(true);
	};
	const fetchUserProfile = async () => {
		try {
			setLoading(true);
			const auth = FIREBASE_AUTH;
			const db = FIREBASE_DB;
			const user = auth.currentUser;
			if (user) {
				const unsub = onSnapshot(
					doc(db, "users", user.uid),
					(docSnap) => {
						if (docSnap.exists()) {
							const data = docSnap.data();
							setName(data?.name);
							setProfileUrl(data?.profileUrl || null);
						}
						setLoading(false);
					},
					(error) => {
						// Silently handle permission-denied errors (happens during logout)
						if (error.code === "permission-denied") {
							console.log(
								"🔒 Permission denied in Settings - user likely logged out"
							);
						} else {
							console.error("❌ Error in Settings onSnapshot:", error);
						}
						setLoading(false);
					}
				);

				// cleanup listener on unmount
				return unsub;
			}
		} catch (e) {
			console.error("Error fetching profile:", e);
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchUserProfile();
	}, []);

	console.log("User details in Settings:", user.email);
	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.topContainer}>
				<Text style={styles.name}>{name}</Text>
				{profileUrl ? (
					<Image
						source={{ uri: profileUrl }}
						style={{ width: 80, height: 80, borderRadius: 40 }}
					/>
				) : (
					<Avatar height={80} width={80} />
				)}
			</View>
			<View style={styles.middleContainer}>
				<Pressable
					style={styles.iconContainer}
					onPress={() => navigation.navigate("History")}
				>
					<MaterialCommunityIcons
						name="car-clock"
						size={35}
						color={colors.primaryBlue}
					/>
					<Text style={styles.iconText}>Ride history</Text>
				</Pressable>

				<Pressable
					style={styles.iconContainer}
					onPress={() => navigation.navigate("About")}
				>
					<Foundation name="info" size={35} color={colors.primaryBlue} />
					<Text style={styles.iconText}>About</Text>
				</Pressable>
			</View>
			<View style={styles.bottomContainer}>
				<Pressable
					style={styles.options}
					onPress={() => navigation.navigate("Profile")}
				>
					<Ionicons name="settings" size={20} color="black" />
					<Text style={styles.optionText}>Edit Profile</Text>
				</Pressable>
				<Pressable style={styles.options}>
					<MaterialIcons name="support-agent" size={20} color="black" />
					<Text style={styles.optionText}>Support</Text>
				</Pressable>
				<Pressable style={styles.options} onPress={() => openModal("Logout")}>
					<MaterialCommunityIcons name="logout" size={24} color="black" />
					<Text style={styles.optionText}>Logout</Text>
				</Pressable>
				<Pressable
					style={styles.options}
					onPress={() => openModal("Delete Account")}
				>
					<MaterialIcons name="delete-forever" size={24} color="black" />
					<Text style={styles.optionText}>Delete Account</Text>
				</Pressable>
			</View>
			{modal && (
				<Confirmation1 modal={modal} setModal={setModal} title={modalTitle} />
			)}
		</SafeAreaView>
	);
};

export default Settings;

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "white",

		padding: 16,
	},
	topContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 30,
	},
	name: {
		fontSize: 35,
		// fontWeight:"bold",
		fontFamily: "Albert-SemiBold",
		maxWidth: "70%",
	},
	middleContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
	},
	iconContainer: {
		width: "45%",
		height: 95,
		borderRadius: 7,
		backgroundColor: colors.lightGrey2,
		alignItems: "center",
		justifyContent: "space-between",
		paddingVertical: 14,
	},
	iconText: {
		fontSize: 15,
		fontFamily: "Albert-Medium",
	},
	bottomContainer: {
		marginTop: 20,
	},
	options: {
		flexDirection: "row",
		gap: 10,
		marginVertical: 16,
	},
	optionText: {
		fontSize: 16,
		fontFamily: "Albert-Medium",
	},
});
