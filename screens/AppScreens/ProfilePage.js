import {
	StatusBar,
	StyleSheet,
	Text,
	ToastAndroid,
	View,
	ActivityIndicator,
} from "react-native";
import React, { useState, useEffect } from "react";
import { colors } from "../../constants/styling";
import BackButton from "../../components/buttons/BackButton";
import Avatar from "../../assets/svg/Frame 91profile.svg";
import EditableInput from "../../components/EditableInput";
import { FIREBASE_AUTH, FIREBASE_DB } from "../../firebaseConfig";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import Toast from "react-native-toast-message";

const ProfilePage = () => {
	const [name, setName] = useState("");
	const [phone, setPhone] = useState("");
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(true);
	const [updating, setUpdating] = useState(false);

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
				alert("No user logged in");
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
				setTempValues({
					name: data.name || data.fullname || "",
					phone: data.phone || "",
					email: data.email || "",
				});
				console.log("✅ Profile loaded:", data);
			}
		} catch (error) {
			console.error("❌ Error fetching profile:", error);
			alert("Failed to load profile");
		} finally {
			setLoading(false);
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
			alert("Field cannot be empty");
			return;
		}

		setUpdating(true);
		try {
			const user = FIREBASE_AUTH.currentUser;
			if (!user) {
				alert("No user logged in");
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

			console.log(`✅ Updated ${fieldName}:`, value);
		} catch (error) {
			console.error("❌ Error updating profile:", error);
			alert("Failed to update profile. Please try again.");
		} finally {
			setUpdating(false);
		}
	};

	if (loading) {
		return (
			<View
				style={[
					styles.container,
					{ justifyContent: "center", alignItems: "center" },
				]}
			>
				<ActivityIndicator size="large" color={colors.primaryBlue} />
				<Text style={{ marginTop: 10 }}>Loading profile...</Text>
			</View>
		);
	}
	return (
		<View style={styles.container}>
			<BackButton text={<Text style={styles.headText}>Edit Profile</Text>} />
			<View style={styles.avatarCont}>
				<Avatar width={100} height={100} />
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
		</View>
	);
};

export default ProfilePage;

const styles = StyleSheet.create({
	container: {
		flex: 1,
		paddingTop: StatusBar.currentHeight,
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
	},
});
