import { StatusBar, StyleSheet, Text, ToastAndroid, View } from "react-native";
import React, { useState } from "react";
import { colors } from "../../constants/styling";
import BackButton from "../../components/buttons/BackButton";
import Avatar from "../../assets/svg/Frame 91profile.svg";
import useAuthStore, { useDriverDetails } from "../../constants/Store";
import EditableInput from "../../components/EditableInput";
import { FIREBASE_DB } from "../../firebaseConfig";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import ActiveButton from "../../components/buttons/ActiveButton";
import { useNavigation } from "@react-navigation/native";

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
		setDriverProfile,
	} = useDriverDetails((state) => ({
		fullName: state.fullName,
		phone: state.phone,
		email: state.email,
		vehicle_id: state.vehicle_id,
		uid: state.uid,
		rating: state.rating,
		totalRides: state.totalRides,
		setDriverProfile: state.setDriverProfile,
	}));

	const profile = useAuthStore((state) => state.profile);

	const [editableStates, setEditableStates] = useState({
		fullName: false,
		phone: false,
		vehicle_id: false,
	});

	const [loading, setLoading] = useState(false);
	const [newFullName, setNewFullName] = useState(
		profile?.fullname || fullName || ""
	);
	const [newPhone, setNewPhone] = useState(profile?.phone || phone || "");
	const [newVehicleId, setNewVehicleId] = useState(
		profile?.vehicle_id || vehicle_id || ""
	);

	const successToast = () => {
		ToastAndroid.show("Updated successfully!", ToastAndroid.SHORT);
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

	const handleEdit = async (field, value) => {
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
			alert("Failed to update profile. Please try again.");
		}
	};

	return (
		<View style={styles.container}>
			<BackButton text={<Text style={styles.headText}>Driver Profile</Text>} />
			<View style={styles.avatarCont}>
				<Avatar width={100} height={100} />
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
				<View style={{ marginTop: 20 }}>
					<ActiveButton
						title="Bank Details"
						onPress={() => navigation.navigate("BankAccountDetails")}
					/>
				</View>
			</View>
		</View>
	);
};

export default DriverProfilePage;

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
});
