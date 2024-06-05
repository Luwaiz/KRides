import { StyleSheet, Text, View } from "react-native";
import React, { useState } from "react";
import { colors } from "../constants/styling";
import ActiveButton from "./ActiveButton";
import InActiveButton from "./InActiveButton";
import Indicator from "./Indicator";
import { OnBoard } from "../constants/OnBoardData";

const Footer = ({currentIndex}) => {
	return (
		<View style={styles.container}>
			<ActiveButton title={"Next"} />
			<InActiveButton title={"Skip"} />
			<Indicator item={OnBoard}  currentIndex={currentIndex}/>
		</View>
	);
};

export default Footer;

const styles = StyleSheet.create({
	container: {
		flex: 0.35,
		backgroundColor: colors.secondary,
		alignItems: "center",
	},
});
