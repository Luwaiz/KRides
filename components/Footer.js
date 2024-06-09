import { StyleSheet, Text, View } from "react-native";
import React, { useState } from "react";
import { colors } from "../constants/styling";
import ActiveButton from "../components/buttons/ActiveButton";
import InActiveButton from "../components/buttons/InActiveButton";
import Indicator from "./Indicator";
import { OnBoard } from "../constants/OnBoardData";

const Footer = ({ currentIndex, NextPage, SkipPage, navigateToHome,setCurrentIndex }) => {
	// footer of the on boarding page
	return (
		<View style={styles.container}>
			<ActiveButton
				title={currentIndex !== OnBoard.length - 1 ? "Next" : "Get started"}
				onPress={() =>
					currentIndex !== OnBoard.length - 1 ? NextPage() : navigateToHome()
				}
			/>
			{currentIndex !== OnBoard.length - 1 && <InActiveButton title={"Skip"} onPress={() => SkipPage()} />}
			<Indicator item={OnBoard} currentIndex={currentIndex} setCurrentIndex={setCurrentIndex}/>
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
