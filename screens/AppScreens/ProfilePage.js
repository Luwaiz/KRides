import { StatusBar, StyleSheet, Text, ToastAndroid, View } from "react-native";
import React, { useState } from "react";
import { colors } from "../../constants/styling";
import BackButton from "../../components/buttons/BackButton";
import Avatar from "../../assets/svg/Frame 91profile.svg";
import { useUserDetails } from "../../constants/Store";
import EditableInput from "../../components/EditableInput";
import axios from "axios";
import API from "../../hooks/API";

const ProfilePage = () => {
	const {
		firstName,
		lastName,
		phone,
		email,
		accessToken,
		setFirstName,
		setLastName,
		setEmail,
		setPhone,
	} = useUserDetails((state) => ({
		firstName: state.firstName,
		lastName: state.lastName,
		phone: state.phone,
		email: state.email,
		accessToken: state.accessToken,
		setFirstName: state.setFirstName,
		setLastName: state.setLastName,
		setEmail: state.setEmail,
		setPhone: state.setPhone,
	}));
	const [editableStates, setEditableStates] = useState({
		firstName: false,
		lastName: false,
		phone: false,
		email: false,
	});
	const [loading, setLoading] = useState(false);
	const [mail, set_email] = useState("");
	const [first_name, set_firstName] = useState("");
	const [last_name, set_lastName] = useState("");
	const [phone_number, set_phone] = useState("");
	const Edit = async (field, value) => {
		if (editableStates[field]) {
			// Field is currently editable, save changes
			await handleEdit(field, value);
		}
		setEditableStates((prevStates) => ({
			...prevStates,
			[field]: !prevStates[field],
		}));
	};
	
	const successToast = () => {
		ToastAndroid.show("Updated successfully !", ToastAndroid.SHORT);
	};

	const handleEdit = async (field, value) => {
		console.log("handleEdit", field, value);
		setLoading(true);
		try {
			const header = {
				headers: { Authorization: `Bearer ${accessToken}` },
			};
			const request = {
				[field]: value,
			};
			const response = await axios.put(
				`${API.UpdateProfile}/${email}`,
				request,
				header
			);
			console.log(response?.data);
			fetchUserProfile(accessToken); // Fetch updated profile after successful edit
			setLoading(false);
		} catch (err) {
			console.log(err?.response?.data?.message);
			setLoading(false);
			alert("Failed to edit profile. Please try again.");
		}
	};
	
	const fetchUserProfile = async (accessToken) => {
		console.log("fetchingUserProfile...");
		try {
			const userResponse = await axios.get(API.UserProfile, {
				headers: { Authorization: `Bearer ${accessToken}` },
			});

			console.log("User Response:", userResponse?.data?.data?.firstName);
			setFirstName(userResponse?.data?.data?.firstName);
			setLastName(userResponse?.data?.data?.lastName);
			setEmail(userResponse?.data?.data?.email);
			setPhone(userResponse?.data?.data?.phone);
			successToast(); // Show success toast after successful edit
		} catch (error) {
			setLoading(false);
			console.error(
				"User Profile Error:",
				error.response?.data || error.message
			);
			alert("Failed to fetch user profile. Please try again.");
		}
	};
	return (
		<View style={styles.container}>
			<BackButton text={<Text style={styles.headText}>Edit Profile</Text>} />
			<View style={styles.avatarCont}>
				<Avatar width={100} height={100} />
			</View>
			<View style={styles.infoCont}>
				<EditableInput
					text={"First Name"}
					editable={editableStates.firstName}
					Edit={() => Edit("firstName", first_name)}
					value={firstName}
					onChangeText={(text) => set_firstName(text)}
					loading={loading}
				/>
				<EditableInput
					text={"Last Name"}
					editable={editableStates.lastName}
					Edit={() => Edit("lastName", last_name)}
					value={lastName}
					onChangeText={(text) => set_lastName(text)}
					loading={loading}
				/>
				<EditableInput
					text={"Phone Number"}
					editable={editableStates.phone}
					Edit={() => Edit("phone", phone_number)}
					value={phone}
					onChangeText={(text) => set_phone(text)}
					loading={loading}
				/>
				<EditableInput
					text={"Email"}
					editable={editableStates.email}
					Edit={() => Edit("email", mail)}
					value={email}
					onChangeText={(text) => set_email(text)}
					loading={loading}
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
