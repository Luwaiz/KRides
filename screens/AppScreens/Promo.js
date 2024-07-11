import { StyleSheet, Text, View } from "react-native";
import React from "react";
import { colors } from "../../constants/styling";
import { SafeAreaView } from "react-native-safe-area-context";
import BackButton from "../../components/buttons/BackButton";
import TextInput1 from "../../components/TextInput1";
import ActiveButton from "../../components/buttons/ActiveButton";
import { useNavigation } from "@react-navigation/native";

const Promo = () => {
    const navigation= useNavigation()
    const toHome= ()=>{
        navigation.goBack()
    }

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.topCont}>
				<BackButton
					text={<Text style={styles.headText}>Enter promo code</Text>}
				/>
			</View>
			<View style={styles.bottomCont}>
				<TextInput1
					placeholder={"e.g PTY204"}
					text={<Text>Enter the code to claim your voucher</Text>}
				/>

				<View style={styles.button}>
					<ActiveButton title={"Submit"} onPress={toHome}/>
				</View>
			</View>
		</SafeAreaView>
	);
};

export default Promo;

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
		fontWeight: "700",
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
		paddingTop: 20,
	},
	button: {
		marginTop: "auto",
		marginBottom: 16,
	},
});
