import { StyleSheet, Text, View } from "react-native";
import BottomSheet from "@gorhom/bottom-sheet";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import WhereTo from "./WhereTo";
import ActiveButton from "./buttons/ActiveButton";
import { colors } from "../constants/styling";
import { useBottomTabStore, useUserDetails } from "../constants/Store";

const HomeTab = () => {
	const Passengers = useBottomTabStore((state)=>state.PassengerPage)
	const {firstName}=useUserDetails((state)=>({
		firstName: state.firstName
	}))
	
	return (
		<BottomSheet
			snapPoints={["46%"]}
			backgroundStyle={{ borderRadius: 30 }}
			handleComponent={null}
		>
			<View style={styles.sheetCont}>
				<View style={styles.topText}>
					<Text style={styles.greet}>
						Hello, <Text style={{ color: colors.primaryBlue }}>{firstName}</Text>
					</Text>
					<Text style={styles.where}>Where are you going?</Text>
				</View>
				<WhereTo />
				<View style={styles.dateCont}>
					<Feather name="calendar" size={24} color={colors.primaryBlue} />
					<Text style={styles.date}>14/7/2023</Text>
				</View>
				<View style={styles.button}>
					<ActiveButton title={"Continue"} onPress={Passengers} />
				</View>
			</View>
		</BottomSheet>
	);
};

export default HomeTab;

const styles = StyleSheet.create({
	sheetCont: {
		flex: 1,
		paddingBottom: 16,
		paddingTop: 30,
		paddingHorizontal: 16,
	},
	topText: {
		marginBottom: 10,
	},
	greet: {
		fontSize: 16,
		fontWeight: "regular",
		color: "black",
		marginBottom: 4,
	},
	where: {
		fontSize: 24,
		fontWeight: "bold",
		color: "black",
	},
	dateCont: {
		flexDirection: "row",
		marginVertical: "auto",
		alignItems: "center",
	},
	date: {
		fontSize: 16,
		fontWeight: "regular",
		color: "black",
	},
	button: {
		marginTop: "auto",
	},
});
