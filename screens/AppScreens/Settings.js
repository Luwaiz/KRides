import { Pressable, StyleSheet, Text, View, Image, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
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
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "@env";
import * as ImagePicker from "expo-image-picker";
import Toast from "react-native-toast-message";

const Settings = ({ navigation }) => {
	const [modal, setModal] = useState(false);
	const [name, setName] = useState("");
	const [profileUrl, setProfileUrl] = useState(null);
	const [loading, setLoading] = useState(false);
	const [uploadingImage, setUploadingImage] = useState(false);

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

	const pickImage = async () => {
		const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (status !== "granted") {
			Alert.alert("Permission Required", "Camera roll permission is needed to update your profile picture.");
			return;
		}

		let result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ImagePicker.MediaTypeOptions.Images,
			allowsEditing: true,
			aspect: [1, 1],
			quality: 0.5,
			base64: true,
		});

		if (!result.canceled) {
			const selectedImage = result.assets[0];
			uploadToCloudinary(selectedImage);
		}
	};

	const uploadToCloudinary = async (imageAsset) => {
		setUploadingImage(true);
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 30000);
		try {
			const cloudName = CLOUDINARY_CLOUD_NAME;
			const uploadPreset = CLOUDINARY_UPLOAD_PRESET;

			const base64Img = `data:image/jpg;base64,${imageAsset.base64}`;
			const data = {
				file: base64Img,
				upload_preset: uploadPreset,
			};

			const response = await fetch(
				`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
				{
					body: JSON.stringify(data),
					headers: {
						"content-type": "application/json",
					},
					method: "POST",
					signal: controller.signal,
				}
			);

			const result = await response.json();
			if (result.secure_url) {
				await saveProfileUrl(result.secure_url);
			} else {
				Alert.alert("Upload Failed", "Image upload did not return a URL. Please try again.");
			}
		} catch (error) {
			if (error.name === "AbortError") {
				Alert.alert("Timeout", "Upload timed out. Please check your connection and try again.");
			} else {
				console.error("Error uploading image:", error);
				Alert.alert("Error", "Could not upload image. Please try again.");
			}
		} finally {
			clearTimeout(timeoutId);
			setUploadingImage(false);
		}
	};

	const saveProfileUrl = async (url) => {
		try {
			const currentUser = FIREBASE_AUTH.currentUser;
			if (!currentUser) return;

			await updateDoc(doc(FIREBASE_DB, "users", currentUser.uid), {
				profileUrl: url,
			});

			setProfileUrl(url);
			Toast.show({
				type: "tomatoToast",
				text1: "Success!",
				text2: "Profile picture updated",
				position: "top",
			});
		} catch (error) {
			console.error("Error saving profile URL:", error);
			Alert.alert("Error", "Failed to save profile picture. Please try again.");
		}
	};

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.topContainer}>
				<Text style={styles.name}>{name}</Text>
				<TouchableOpacity onPress={pickImage} disabled={uploadingImage}>
					{uploadingImage ? (
						<View style={[styles.avatarImage, styles.avatarLoading]}>
							<ActivityIndicator size="small" color={colors.primaryBlue} />
						</View>
					) : profileUrl ? (
						<Image
							source={{ uri: profileUrl }}
							style={styles.avatarImage}
						/>
					) : (
						<Avatar height={80} width={80} />
					)}
				</TouchableOpacity>
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
					onPress={() => navigation.navigate("Home")}
				>
					<Entypo name="home" size={20} color="black" />
					<Text style={styles.optionText}>Home</Text>
				</Pressable>
				<Pressable
					style={styles.options}
					onPress={() => navigation.navigate("Profile")}
				>
					<Ionicons name="settings" size={20} color="black" />
					<Text style={styles.optionText}>Edit Profile</Text>
				</Pressable>
				<Pressable style={styles.options}
					onPress={() => navigation.navigate("Wallet")}
				>
					<MaterialCommunityIcons name="wallet-outline" size={20} color="black" />
					<Text style={styles.optionText}>Wallet</Text>
				</Pressable>
				<Pressable style={styles.options}
					onPress={() => navigation.navigate("Support")}
				>
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
	avatarImage: {
		width: 80,
		height: 80,
		borderRadius: 40,
	},
	avatarLoading: {
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: colors.lightGrey2,
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
