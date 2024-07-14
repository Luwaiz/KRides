import {
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import React, { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome } from "@expo/vector-icons";
import ActiveButton from "../../components/buttons/ActiveButton";
import BackButton from "../../components/buttons/BackButton";
import { colors } from "../../constants/styling";
import Avatar from "../../assets/svg/RideEnd.svg";

const Rating = () => {
	const [rating, setRating] = useState([]);
	const rate = (id) => {
		console.log(id);
		if (!rating.includes({ [id]: true })) {
			setRating([...rating, rating.push({ [id]: true })]);
			console.log(rating);
		} else {
			setRating([...rating, rating.pop()]);
			console.log(rating);
		}
	};

	const rateStars = () => {
		let stars = [];
		for (let i = 0; i < 5; i++) {
			stars.push(
				<TouchableOpacity onPress={() => rate(i)} key={i}>
					<FontAwesome
						name="star"
						size={34}
						color={rating[i] ? "gold" : colors.lightGrey}
					/>
				</TouchableOpacity>
			);
		}
		return stars;
	};
	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.topCont}>
				<BackButton
					text={<Text style={styles.headText}>Your ride has ended!</Text>}
				/>
			</View>

			<View style={styles.bottomCont}>
				<View style={styles.avatarCont}>
					<Avatar width={100} height={100} />
					<Text style={styles.name}>Henry Ade</Text>
				</View>
				<View style={styles.infoCont}>
					<Text style={styles.Text1}>How was your trip?</Text>
					<Text style={styles.Text2}>
						Your feedback will help improve driving experience
					</Text>
					<View style={styles.starCont}>{rateStars()}</View>
				</View>
				<View style={styles.inputCont}>
					<TextInput
						multiline
						placeholder="Your message..."
						placeholderTextColor={colors.lightGrey}
						style={styles.inputBox}
						cursorColor={"black"}
					/>
				</View>
				<View style={styles.button}>
					<ActiveButton title={"Submit Rating"} />
				</View>
			</View>
		</SafeAreaView>
	);
};

export default Rating;

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
		marginTop: 20,
		paddingHorizontal: 16,
		gap: 4,
		justifyContent: "center",
	},
	Text1: {
		fontSize: 18,
		color: "black",
		fontFamily: "Albert-SemiBold",
		textAlign: "center",
	},
	Text2: {
		color: colors.lightGrey3,
		fontSize: 16,
		fontFamily: "Albert-Regular",
		textAlign: "center",
	},
	bottomCont: {
		flex: 1,
		paddingHorizontal: 16,
	},
	button: {
		marginTop: "auto",
		marginBottom: 16,
	},
	avatarCont: {
		marginVertical: 30,
		alignItems: "center",
	},
	name: {
		color: "black",
		fontSize: 16,
		fontFamily: "Albert-Regular",
		marginTop: 10,
	},
	starCont: {
		flexDirection: "row",
		justifyContent: "center",
		gap: 10,
		marginVertical: 20,
	},
	inputCont: {
		width: "80%",
		height: 200,
		backgroundColor: colors.lightGrey2,
		borderRadius: 6,
		padding: 16,
		alignSelf: "center",
	},
});
