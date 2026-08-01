import {
	StyleSheet,
	Text,
	View,
	ActivityIndicator,
	Image,
	TouchableOpacity,
	Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState, useEffect } from "react";
import { colors } from "../../constants/styling";
import BackButton from "../../components/buttons/BackButton";
import Avatar from "../../assets/svg/Frame 91profile.svg";
import EditableInput from "../../components/EditableInput";
import { FIREBASE_AUTH, FIREBASE_DB } from "../../firebaseConfig";
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "@env";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import Toast from "react-native-toast-message";
import * as ImagePicker from "expo-image-picker";

const ProfilePage = () => {
	const [name, setName] = useState("");
	const [phone, setPhone] = useState("");
	const [email, setEmail] = useState("");
	const [profileUrl, setProfileUrl] = useState(null);
	const [loading, setLoading] = useState(true);
	const [updating, setUpdating] = useState(false);
	const [uploadingImage, setUploadingImage] = useState(false);

	const [editableStates, setEditableStates] = useState({
		name: false,
		phone: false,
		email: false,
	});

	const [tempValues, setTempValues] = useState({
		name: "",
		phone: "",
		email: "",
	});

	// Fetch user profile on mount
	useEffect(() => {
		fetchUserProfile();
	}, []);

	const fetchUserProfile = async () => {
		setLoading(true);
		try {
			const user = FIREBASE_AUTH.currentUser;
			if (!user) {
				Alert.alert("Error", "No user logged in");
				return;
			}

			// Try to get user from "users" collection first (customers)
			let userDoc = await getDoc(doc(FIREBASE_DB, "users", user.uid));

			// If not found, try "drivers" collection
			if (!userDoc.exists()) {
				userDoc = await getDoc(doc(FIREBASE_DB, "drivers", user.uid));
			}

			if (userDoc.exists()) {
				const data = userDoc.data();
				setName(data.name || data.fullname || "");
				setPhone(data.phone || "");
				setEmail(data.email || "");
				setProfileUrl(data.profileUrl || null);
				setTempValues({
					name: data.name || data.fullname || "",
					phone: data.phone || "",
					email: data.email || "",
				});
				if (__DEV__) console.log("✅ Profile loaded:", data);
			}
		} catch (error) {
			console.error("❌ Error fetching profile:", error);
			Alert.alert("Error", "Failed to load profile");
		} finally {
			setLoading(false);
		}
	};

	const isPhoneValid = (phone) => {
		// Check if phone is exactly 11 digits
		const phoneRegex = /^\d{11}$/;
		return phoneRegex.test(phone);
	};

	const isEmailValid = (email) => {
		// Basic email validation
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(email);
	};

	const isNameValid = (name) => {
		// Name should be at least 2 characters
		return name && name.trim().length >= 2;
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
		setUploadingImage(true);
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 30000);
		try {
			const cloudName = CLOUDINARY_CLOUD_NAME;
			const uploadPreset = CLOUDINARY_UPLOAD_PRESET;

			let base64Img = `data:image/jpg;base64,${imageAsset.base64}`;
			let data = {
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
			const user = FIREBASE_AUTH.currentUser;
			if (!user) return;

			let userDoc = await getDoc(doc(FIREBASE_DB, "users", user.uid));
			const isDriver = !userDoc.exists();
			const collection = isDriver ? "drivers" : "users";

			await updateDoc(doc(FIREBASE_DB, collection, user.uid), {
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

	const Edit = async (field, value) => {
		if (editableStates[field]) {
			// Field is currently editable, save changes
			await handleEdit(field, value);
		} else {
			// Entering edit mode, sync temp value with current value
			setTempValues((prev) => ({
				...prev,
				[field]: field === "name" ? name : field === "phone" ? phone : email,
			}));
		}
		setEditableStates((prevStates) => ({
			...prevStates,
			[field]: !prevStates[field],
		}));
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
		if (field === "name" && !isNameValid(value)) {
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

		if (field === "email" && !isEmailValid(value)) {
			Alert.alert(
				"Oops! Invalid Email",
				"Please enter a valid email address (e.g., johndoe@gmail.com) 📧"
			);
			return;
		}

		setUpdating(true);
		try {
			const user = FIREBASE_AUTH.currentUser;
			if (!user) {
				Alert.alert("Error", "No user logged in");
				return;
			}

			// Determine which collection to update
			let userDoc = await getDoc(doc(FIREBASE_DB, "users", user.uid));
			const isDriver = !userDoc.exists();
			const collection = isDriver ? "drivers" : "users";
			const fieldName = field === "name" && isDriver ? "fullname" : field;

			await updateDoc(doc(FIREBASE_DB, collection, user.uid), {
				[fieldName]: value.trim(),
			});

			// Update local state
			if (field === "name") setName(value.trim());
			if (field === "phone") setPhone(value.trim());
			if (field === "email") setEmail(value.trim());

			Toast.show({
				type: "tomatoToast",
				text1: "Success!",
				text2: "Profile updated successfully",
				position: "top",
				visibilityTime: 2000,
			});

			if (__DEV__) console.log(`✅ Updated ${fieldName}:`, value);
		} catch (error) {
			console.error("❌ Error updating profile:", error);
			Alert.alert("Error", "Failed to update profile. Please try again.");
		} finally {
			setUpdating(false);
		}
	};

	if (loading) {
		return (
			<SafeAreaView
				style={[
					styles.container,
					{ justifyContent: "center", alignItems: "center" },
				]}
			>
				<ActivityIndicator size="large" color={colors.primaryBlue} />
				<Text style={{ marginTop: 10 }}>Loading profile...</Text>
			</SafeAreaView>
		);
	}
	return (
		<SafeAreaView style={styles.container}>
			<BackButton text={<Text style={styles.headText}>Edit Profile</Text>} />
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
			<View style={styles.infoCont}>
				<EditableInput
					text={"Name"}
					editable={editableStates.name}
					Edit={() => Edit("name", tempValues.name)}
					value={editableStates.name ? tempValues.name : name}
					onChangeText={(text) => setTempValues({ ...tempValues, name: text })}
					loading={updating}
				/>
				<EditableInput
					text={"Phone Number"}
					editable={editableStates.phone}
					Edit={() => Edit("phone", tempValues.phone)}
					value={editableStates.phone ? tempValues.phone : phone}
					onChangeText={(text) => setTempValues({ ...tempValues, phone: text })}
					loading={updating}
				/>
				<EditableInput
					text={"Email"}
					editable={editableStates.email}
					Edit={() => Edit("email", tempValues.email)}
					value={editableStates.email ? tempValues.email : email}
					onChangeText={(text) => setTempValues({ ...tempValues, email: text })}
					loading={updating}
				/>
			</View>
		</SafeAreaView>
	);
};

export default ProfilePage;

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.secondary,
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
});
