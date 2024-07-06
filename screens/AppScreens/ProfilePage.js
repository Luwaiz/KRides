import { StatusBar, StyleSheet, Text, View } from "react-native";
import React from "react";
import { colors } from "../../constants/styling";
import BackButton from "../../components/buttons/BackButton";
import TextInput1 from "../../components/TextInput1";
import Avatar from "../../assets/svg/Frame 91profile.svg";

const ProfilePage = () => {
	return (
		<View style={styles.container}>
			<BackButton text={<Text style={styles.headText}>Edit Profile</Text>} />
			<View style={styles.avatarCont}>
				<Avatar width={100} height={100}/>
			</View>
			<View style={styles.infoCont}>
				<TextInput1 text={"First Name"} />
				<TextInput1 text={"Last Name"} />
				<TextInput1 text={"Phone Number"} />
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
		fontWeight: "700",
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
