import { Pressable, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from "react-native";
import React, { useState } from "react";
import { FontAwesome } from "@expo/vector-icons";

import { colors } from "../constants/styling";

const StarRating = ({ RateChange }) => {
	const [rated, setRated] = useState(0);

	const rate = (star) => {
		console.log(rated);
		setRated(star);
		if (RateChange) {
			RateChange(star);
		}
	};
	const numberOfStars = 5;
	let stars = [];
	for (let i = 0; i < numberOfStars; i++) {
		stars.push(
			<Pressable key={i} onPress={() => rate(i + 1)}>
				<FontAwesome
					name="star"
					size={40}
					color={i < rated ? "#F8B454" : colors.lightGrey3}
				/>
			</Pressable>
		);
	}
	return <View style={styles.container}>{stars}</View>;
};

export default StarRating;

const styles = StyleSheet.create({
	container: {
		flexDirection: "row",
		gap: 10,
		justifyContent: "center",
		alignItems: "center",
        marginVertical:20
	},
});
