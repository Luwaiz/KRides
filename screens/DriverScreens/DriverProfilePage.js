import { StyleSheet, Text, View, Image, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AntDesign } from "@expo/vector-icons";
import React, { useState, useEffect } from "react";
import { colors } from "../../constants/styling";
import BackButton from "../../components/buttons/BackButton";
import Avatar from "../../assets/svg/Frame 91profile.svg";
import useAuthStore, { useDriverDetails } from "../../constants/Store";
import EditableInput from "../../components/EditableInput";
import { FIREBASE_DB, FIREBASE_AUTH } from "../../firebaseConfig";
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "@env";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import ActiveButton from "../../components/buttons/ActiveButton";
import { useNavigation } from "@react-navigation/native";
import { ScrollView } from "react-native-gesture-handler";
import * as ImagePicker from "expo-image-picker";
import Toast from "react-native-toast-message";

const DriverProfilePage = () => {
	const navigation = useNavigation();
	const {
		fullName,
		phone,
		email,
		vehicle_id,
		uid,
		rating,
		totalRides,
		bankName,
		accountNumber,
		accountName,
		setDriverProfile,
	} = useDriverDetails((state) => ({
		fullName: state.fullName,
		phone: state.phone,
		email: state.email,
		vehicle_id: state.vehicle_id,
		uid: state.uid,
		rating: state.rating,
		totalRides: state.totalRides,
		bankName: state.bankName,
		accountNumber: state.accountNumber,
		accountName: state.accountName,
		setDriverProfile: state.setDriverProfile,
	}));

	const profile = useAuthStore((state) => state.profile);

	const [editableStates, setEditableStates] = useState({
		fullName: false,
		phone: false,
		vehicle_id: false,
	});

	const [loading, setLoading] = useState(false);
	const [uploadingImage, setUploadingImage] = useState(false);
	const [profileUrl, setProfileUrl] = useState(profile?.profileUrl || null);

	const [newFullName, setNewFullName] = useState(
		profile?.fullname || fullName || ""
	);
	const [newPhone, setNewPhone] = useState(profile?.phone || phone || "");
	const [newVehicleId, setNewVehicleId] = useState(
		profile?.vehicle_id || vehicle_id || ""
	);

	useEffect(() => {
		if (profile?.profileUrl) {
			setProfileUrl(profile.profileUrl);
		}
	}, [profile]);

	const successToast = () => {
		Toast.show({
			type: "tomatoToast",
			text1: "Profile Updated",
			text2: "Your changes have been saved.",
			position: "top",
			visibilityTime: 2000,
		});
	};

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
		if (!imageAsset.base64) {
			Alert.alert("Error", "Could not read image data. Please try a different photo.");
			return;
		}

		setUploadingImage(true);
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 30000);
		try {
			const cloudName = CLOUDINARY_CLOUD_NAME;
			const uploadPreset = CLOUDINARY_UPLOAD_PRESET;

			const base64Img = `data:image/jpg;base64,${imageAsset.base64}`;
			const data = { file: base64Img, upload_preset: uploadPreset };

			const response = await fetch(
				`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
				{
					body: JSON.stringify(data),
					headers: { "content-type": "application/json" },
					method: "POST",
					signal: controller.signal,
				}
			);

			if (!response.ok) {
				throw new Error(`Upload failed (${response.status})`);
			}

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
			const driverUid = profile?.uid || uid;
			if (!driverUid) return;

			const driverRef = doc(FIREBASE_DB, "drivers", driverUid);
			await updateDoc(driverRef, {
				profileUrl: url,
			});

			setProfileUrl(url);

			// Update local store
			const driverSnap = await getDoc(driverRef);
			if (driverSnap.exists()) {
				const updatedProfile = driverSnap.data();
				setDriverProfile(updatedProfile);
				const { setAuthData, user, role } = useAuthStore.getState();
				setAuthData(user, updatedProfile, role);
			}

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

	const Edit = async (field, value) => {
		if (editableStates[field]) {
			// Field is currently editable, save changes
			await handleEdit(field, value);
		}
		// Toggle the editable state
		setEditableStates((prevStates) => ({
			...prevStates,
			[field]: !prevStates[field],
		}));
	};

	const isPhoneValid = (phone) => {
		// Check if phone is exactly 11 digits
		const phoneRegex = /^\d{11}$/;
		return phoneRegex.test(phone);
	};

	const isNameValid = (name) => {
		// Name should be at least 2 characters
		return name && name.trim().length >= 2;
	};

	const isVehicleIdValid = (vehicleId) => {
		// Vehicle ID should not be empty
		return vehicleId && vehicleId.trim().length > 0;
	};

	const handleEdit = async (field, value) => {
		if (!value || value.trim() === "") {
			Alert.alert(
				"Oops! Empty Field",
				"This field cannot be empty. Please enter a valid value 📝"
			);
			return;
		}

		// Validate based on field type
		if ((field === "fullName" || field === "name") && !isNameValid(value)) {
			Alert.alert(
				"Oops! Invalid Name",
				"Please enter a valid name (at least 2 characters) 😊"
			);
			return;
		}

		if (field === "phone" && !isPhoneValid(value)) {
			Alert.alert(
				"Oops! Invalid Phone Number",
				"Phone number must be exactly 11 digits (e.g., 08123456789) 📞"
			);
			return;
		}

		if (field === "vehicle_id" && !isVehicleIdValid(value)) {
			Alert.alert(
				"Oops! Invalid Vehicle ID",
				"Please enter a valid vehicle ID 🚗"
			);
			return;
		}

		setLoading(true);
		try {
			// Get the current user's UID from profile
			const driverUid = profile?.uid || uid;
			if (!driverUid) {
				throw new Error("User ID not found");
			}

			// Update the field in Firestore drivers collection
			const driverRef = doc(FIREBASE_DB, "drivers", driverUid);

			// Map field names to Firestore field names
			const fieldMap = {
				name: "fullname",
				fullName: "fullname",
				phone: "phone",
				vehicle_id: "vehicle_id",
			};

			const firestoreField = fieldMap[field] || field;
			await updateDoc(driverRef, { [firestoreField]: value });

			// Fetch updated profile
			const driverSnap = await getDoc(driverRef);
			if (driverSnap.exists()) {
				const updatedProfile = driverSnap.data();
				setDriverProfile(updatedProfile);

				// Also update auth store
				const { setAuthData, user, role } = useAuthStore.getState();
				setAuthData(user, updatedProfile, role);

				successToast();
			}
			setLoading(false);
		} catch (error) {
			console.error("Profile update error:", error);
			setLoading(false);
			Alert.alert("Error", "Failed to update profile. Please try again.");
		}
	};

	return (
		<SafeAreaView style={styles.container}>
			<ScrollView contentContainerStyle={styles.scrollContainer}>

				<BackButton text={<Text style={styles.headText}>Driver Profile</Text>} />
				<View style={styles.avatarCont}>
					<TouchableOpacity onPress={pickImage} disabled={uploadingImage}>
						{uploadingImage ? (
							<View style={[styles.profileImage, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }]}>
								<ActivityIndicator size="small" color={colors.primaryBlue} />
							</View>
						) : profileUrl ? (
							<Image source={{ uri: profileUrl }} style={styles.profileImage} />
						) : (
							<Avatar width={100} height={100} />
						)}
						<View style={styles.editBadge}>
							<Text style={styles.editBadgeText}>Edit</Text>
						</View>
					</TouchableOpacity>
				</View>

				<View style={styles.statsCont}>
					<View style={styles.statItem}>
						<Text style={styles.statValue}>
							{profile?.rating
								? profile.rating.toFixed(1)
								: rating?.toFixed(1) || "0.0"}
						</Text>
						<Text style={styles.statLabel}>Rating</Text>
					</View>
					<View style={styles.statItem}>
						<Text style={styles.statValue}>
							{profile?.totalRides || totalRides || 0}
						</Text>
						<Text style={styles.statLabel}>Total Rides</Text>
					</View>
				</View>

				{/* View Reviews Button */}
				<View style={styles.reviewsButtonCont}>
					<TouchableOpacity
						style={styles.reviewsButton}
						onPress={() => navigation.navigate("DriverReviews")}
					>
						<AntDesign name="star" size={20} color={colors.primaryBlue} />
						<Text style={styles.reviewsButtonText}>View All Reviews</Text>
						<AntDesign name="right" size={16} color={colors.primaryBlue} />
					</TouchableOpacity>
				</View>

				<View style={styles.infoCont}>
					<EditableInput
						text={"Full Name"}
						editable={editableStates.fullName}
						Edit={() => Edit("fullName", newFullName)}
						value={newFullName}
						onChangeText={(text) => setNewFullName(text)}
						loading={loading}
					/>
					<EditableInput
						text={"Phone Number"}
						editable={editableStates.phone}
						Edit={() => Edit("phone", newPhone)}
						value={newPhone}
						onChangeText={(text) => setNewPhone(text)}
						loading={loading}
					/>
					<EditableInput
						text={"Vehicle ID"}
						editable={editableStates.vehicle_id}
						Edit={() => Edit("vehicle_id", newVehicleId)}
						value={newVehicleId}
						onChangeText={(text) => setNewVehicleId(text)}
						loading={loading}
					/>
					<EditableInput
						text={"Email"}
						value={profile?.email || email || ""}
						editable={false}
					/>
					{/* Only offer to set up bank details when none are on file yet —
						once they exist, the card below is shown instead. */}
					{!(profile?.bankName || bankName) && (
						<View style={{ marginTop: 20 }}>
							<ActiveButton
								title="Bank Details"
								onPress={() => navigation.navigate("BankAccountDetails")}
							/>
						</View>
					)}

					{/* Display Bank Details if available */}
					{(profile?.bankName || bankName) && (
						<View style={styles.bankDetailsCont}>
							<Text style={styles.bankHeader}>Bank Information</Text>
							<View style={styles.bankRow}>
								<Text style={styles.bankLabel}>Bank Name:</Text>
								<Text style={styles.bankValue}>{profile?.bankName || bankName}</Text>
							</View>
							<View style={styles.bankRow}>
								<Text style={styles.bankLabel}>Account Number:</Text>
								<Text style={styles.bankValue}>
									{profile?.accountNumber || accountNumber}
								</Text>
							</View>
							<View style={styles.bankRow}>
								<Text style={styles.bankLabel}>Account Name:</Text>
								<Text style={styles.bankValue}>
									{profile?.accountName || accountName}
								</Text>
							</View>
							<TouchableOpacity
								style={styles.editBankButton}
								onPress={() => navigation.navigate("BankAccountDetails", { isEditing: true })}
							>
								<Text style={styles.editBankButtonText}>Edit Bank Details</Text>
							</TouchableOpacity>
						</View>
					)}
				</View>
			</ScrollView>
		</SafeAreaView>
	);
};

export default DriverProfilePage;

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.secondary,
	},
	scrollContainer: {
		paddingBottom: 20
	},
	headText: {
		color: "black",
		fontSize: 24,
		fontFamily: "Albert-SemiBold",
	},
	infoCont: {
		paddingHorizontal: 16,
		justifyContent: "center",
	},
	avatarCont: {
		alignSelf: "center",
		marginVertical: 24,
		position: 'relative',
	},
	profileImage: {
		width: 100,
		height: 100,
		borderRadius: 50,
	},
	editBadge: {
		position: 'absolute',
		bottom: 0,
		right: 0,
		backgroundColor: colors.primaryBlue,
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 12,
	},
	editBadgeText: {
		color: 'white',
		fontSize: 10,
		fontFamily: 'Albert-Medium',
	},
	statsCont: {
		flexDirection: "row",
		justifyContent: "space-around",
		marginBottom: 24,
		paddingHorizontal: 32,
	},
	statItem: {
		alignItems: "center",
	},
	statValue: {
		fontSize: 24,
		fontFamily: "Albert-Bold",
		color: colors.primaryBlue,
	},
	statLabel: {
		fontSize: 14,
		fontFamily: "Albert-Regular",
		color: colors.textGrey,
	},
	bankDetailsCont: {
		marginTop: 24,
		padding: 16,
		backgroundColor: "#fff",
		borderRadius: 12,
		elevation: 2,
	},
	bankHeader: {
		fontSize: 18,
		fontFamily: "Albert-Bold",
		color: colors.primaryBlue,
		marginBottom: 12,
	},
	bankRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: 8,
	},
	bankLabel: {
		fontSize: 14,
		fontFamily: "Albert-Medium",
		color: colors.textGrey,
	},
	bankValue: {
		fontSize: 14,
		fontFamily: "Albert-SemiBold",
		color: "#333",
	},
	editBankButton: {
		marginTop: 16,
		alignSelf: "center",
		paddingHorizontal: 20,
		paddingVertical: 10,
		borderRadius: 20,
		borderWidth: 1.5,
		borderColor: colors.primaryBlue,
	},
	editBankButtonText: {
		fontSize: 14,
		fontFamily: "Albert-SemiBold",
		color: colors.primaryBlue,
	},
	reviewsButtonCont: {
		paddingHorizontal: 16,
		marginBottom: 16,
	},
	reviewsButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "white",
		paddingVertical: 14,
		paddingHorizontal: 20,
		borderRadius: 12,
		borderWidth: 1.5,
		borderColor: colors.primaryBlue,
		gap: 8,
		elevation: 2,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
	},
	reviewsButtonText: {
		fontSize: 16,
		fontFamily: "Albert-SemiBold",
		color: colors.primaryBlue,
	},
});
