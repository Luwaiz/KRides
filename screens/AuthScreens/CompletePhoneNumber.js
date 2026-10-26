import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import React, { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../constants/styling";
import DismissKeyboardView from "../../components/DismissKeyboardView";
import TextInput1 from "../../components/TextInput1";
import ActiveButton from "../../components/buttons/ActiveButton";
import Firebase from "../../hooks/Firebase";
import useAuthStore, { useUserDetails } from "../../constants/Store";
import { FIREBASE_DB } from "../../firebaseConfig";
import { doc, updateDoc } from "firebase/firestore";

const CompletePhoneNumber = ({ navigation }) => {
	const [phone, setPhone] = useState("");
	const [loading, setLoading] = useState(false);

	const user = useAuthStore((state) => state.user);
	const profile = useAuthStore((state) => state.profile);
	const setAuthData = useAuthStore((state) => state.setAuthData);
	const setUserPhone = useUserDetails((state) => state.setPhone);

	const handleContinue = async () => {
		const normalizedPhone = Firebase.normalizeNigerianPhone(phone);
		if (!normalizedPhone) {
			Alert.alert(
				"Invalid Phone Number",
				"Please enter a valid Nigerian phone number (e.g. 08012345678)."
			);
			return;
		}

		if (!user?.uid) {
			Alert.alert("Error", "Your session expired. Please sign in again.");
			return;
		}

		setLoading(true);
		try {
			await updateDoc(doc(FIREBASE_DB, "users", user.uid), {
				phone: normalizedPhone,
			});

			setAuthData(user, { ...profile, phone: normalizedPhone }, "customer");
			setUserPhone(normalizedPhone);

			navigation.replace("Home");
		} catch (error) {
			console.error("❌ Error saving phone number:", error);
			Alert.alert("Error", "Could not save your phone number. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
			<KeyboardAvoidingView
				style={{ flex: 1 }}
				behavior={Platform.OS === "ios" ? "padding" : "height"}
			>
				<DismissKeyboardView>
					<View style={{ flex: 1 }}>
						<View style={styles.topCont}>
							<Text style={styles.headText}>One last thing</Text>
						</View>
						<View style={styles.bottomCont}>
							<Text style={styles.infoText}>
								We need your phone number so drivers can reach you about your ride.
							</Text>
							<TextInput1
								text={"Phone Number"}
								placeholder={"08123456789 or +2348123456789"}
								onChangeText={setPhone}
								value={phone}
								keyboardType="phone-pad"
							/>
							<View style={styles.button}>
								<ActiveButton
									title={"Continue"}
									loading={loading}
									onPress={handleContinue}
								/>
							</View>
						</View>
					</View>
				</DismissKeyboardView>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
};

export default CompletePhoneNumber;

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.primaryBlue,
	},
	topCont: {
		backgroundColor: colors.primaryBlue,
		paddingTop: 26,
		paddingHorizontal: 16,
		paddingBottom: 16,
	},
	headText: {
		color: colors.secondary,
		fontSize: 24,
		fontFamily: "Albert-SemiBold",
	},
	bottomCont: {
		flex: 1,
		backgroundColor: colors.secondary,
		width: "100%",
		marginTop: 32,
		borderTopLeftRadius: 30,
		borderTopRightRadius: 30,
		paddingHorizontal: 16,
		paddingTop: 30,
	},
	infoText: {
		color: colors.lightGrey3,
		fontSize: 15,
		marginBottom: 24,
		lineHeight: 21,
	},
	button: {
		marginTop: 16,
	},
});
