import { StyleSheet, Text, View, KeyboardAvoidingView, Platform } from "react-native";
import React, { useState } from "react";
import { OtpInput } from "react-native-otp-entry";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../constants/styling";
import DismissKeyboardView from "../../components/DismissKeyboardView";
import BackButton from "../../components/buttons/BackButton";
import ActiveButton from "../../components/buttons/ActiveButton";
import TextInput1 from "../../components/TextInput1";
import { useUserDetails } from "../../constants/Store";

const Name = ({ navigation }) => {
	const ToHome = () => {
		navigation.replace("AppStack", {
			params: {
				params: "Home",
			},
		});
	};

	const { email, phone } = useUserDetails((state) => ({
		email: state.email,
		phone: state.phone,
	}));
	const ToUpload = () => {
		navigation.navigate("UploadPicture");
	};
	return (
		<SafeAreaView style={styles.container}>
			<KeyboardAvoidingView
				style={{ flex: 1 }}
				behavior={Platform.OS === "ios" ? "padding" : "height"}
			>
				<DismissKeyboardView>
					<View style={{ flex: 1 }}>
						<View style={styles.topCont}>
							<BackButton
								text={<Text style={styles.headText}>What’s your name?</Text>}
							/>
						</View>
						<View style={styles.infoCont}>
							<Text style={styles.infoText}>Let's know you better!</Text>
						</View>
						<View style={styles.bottomCont}>
							<TextInput1 text={"First Name"} placeholder={"e.g John"} />
							<TextInput1 text={"Last Name"} placeholder={"e.g Dotun"} />
							<View style={styles.button}>
								<ActiveButton title={"Submit1"} onPress={ToHome} />
								<ActiveButton title={"Submit2"} onPress={ToUpload} />
							</View>
						</View>
					</View>
				</DismissKeyboardView>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
};

export default Name;

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.secondary2,
	},
	topCont: {
		paddingTop: 26,
	},
	headText: {
		color: "black",
		fontSize: 24,
		fontFamily: "Albert-SemiBold",
	},
	infoCont: {
		marginVertical: 16,
		paddingHorizontal: 16,
		gap: 4,
		justifyContent: "center",
	},
	infoText: {
		color: colors.lightGrey3,
		fontSize: 16,
	},
	bottomCont: {
		flex: 1,
		paddingHorizontal: 16,
	},
	button: {
		marginTop: "auto",
		marginBottom: 16,
	},
});
