import { StyleSheet, Text, View } from "react-native";
import React, { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../constants/styling";
import Upload from "../../assets/svg/uploadImage.svg";
import BackButton from "../../components/buttons/BackButton";
import ActiveButton from "../../components/buttons/ActiveButton";

const UploadPicture = ({ navigation }) => {
	const ToHome = () => {
		navigation.replace("DriverDrawer", {
			screen: "DriverStack",
			screen: {
				screen: "DriverHome",
			}});
	};
	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.topCont}>
				<BackButton
					text={
						<Text style={styles.headText}>Upload your profile picture</Text>
					}
				/>
			</View>
			<View style={styles.infoCont}>
				<Text style={styles.infoText}>Please upload a clear selfie</Text>
			</View>
			<View style={styles.bottomCont}>
				<Upload />
				<View style={styles.button}>
					<ActiveButton title={"Submit"} onPress={ToHome} />
				</View>
			</View>
		</SafeAreaView>
	);
};

export default UploadPicture;

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
	pictureCont: {
		height: 200,
		width: "100%",
		marginBottom: 16,
		borderRadius: 10,
		overflow: "hidden",
		borderStyle: "dotted",
		borderColor: colors.primaryBlue,
		borderWidth: 1,
	},
	button: {
		marginTop: "auto",
		marginBottom: 16,
	},
});
