import { StyleSheet, Text, TextInput, View } from "react-native";
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import ActiveButton from "../../components/buttons/ActiveButton";
import { colors } from "../../constants/styling";
import BackButton from "../../components/buttons/BackButton";
import RideEndImage from "../../assets/svg/RideEnd.svg";
import { AirbnbRating, Rating } from "react-native-ratings";
import StarRating from "../../components/StarRating";

const Ratings = () => {
	const handleRatingChange = (newRating) => {
		console.log('New rating:', newRating);
	  };
	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.topCont}>
				<BackButton
					text={<Text style={styles.headText}>Your ride has ended!</Text>}
				/>
			</View>
			<View style={styles.bottomCont}>
				<View style={styles.AvatarCont}>
					<RideEndImage />
					<Text style={styles.name}>Henry Ade</Text>
				</View>
				<View style={styles.infoCont}>
					<Text style={styles.Text1}>How was your Trip?</Text>
					<Text style={styles.Text2}>
						Your Your feedback will help improve driving experience
					</Text>
				</View>
				<StarRating RateChange={handleRatingChange}/>
				<View style={styles.inputContainer}>
					<TextInput
						placeholder="Your message..."
						multiline
						placeholderTextColor={colors.lightGrey}
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

export default Ratings;

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
		gap: 5,
		justifyContent: "center",
		marginTop: 30,
		paddingHorizontal: 30,
	},
	name: {
		fontSize: 16,
		fontFamily: "Albert-Bold",
		textAlign: "center",
		color: "black",
	},
	AvatarCont: {
		alignSelf: "center",
		justifyContent: "center",
		alignItems: "center",
		marginVertical: 16,
		gap: 10,
	},
	Text1: {
		fontSize: 20,
		fontFamily: "Albert-SemiBold",
		textAlign: "center",
	},
	Text2: {
		fontSize: 16,
		fontFamily: "Albert-Regular",
		textAlign: "center",
		color: colors.lightGrey3,
	},
	inputContainer: {
		borderRadius: 8,
		backgroundColor: colors.lightGrey2,
		padding: 16,
		marginVertical: 10,
		height: 200,
		width: "80%",
		alignSelf: "center",
	},
	ratingBackground: {
		// backgroundColor: colors.lightGrey3,
        // borderRadius: 8,
        // padding: 16,
        // marginVertical: 10,
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
