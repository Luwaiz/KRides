import {
	Dimensions,
	SafeAreaViewBase,
	StyleSheet,
	Text,
	View,
} from "react-native";
import React, { useState } from "react";
import { colors } from "../../constants/styling";
import { SafeAreaView } from "react-native-safe-area-context";
import BackButton from "../../components/buttons/BackButton";
import Direction from "../../assets/svg/Frame 34direction.svg";
import { Shadow } from "react-native-shadow-2";
const { width, height } = Dimensions.get("screen");

const History = () => {
	const [status, setStatus] = useState(true);
	return (
		<SafeAreaView style={styles.container}>
			<BackButton text={<Text style={styles.headText}>Ride history</Text>} />
			<View style={styles.bottomContainer}>
				<Text style={styles.monthDate}>July 2023</Text>
				<View>
				<Shadow distance={15} offset={[3,2]}>
					<View style={styles.historyContainer}>
					<Text style={styles.dayDate}>16 july 2023</Text>
						<View style={styles.locationCont}>
							<Direction width={40} height={80} />
							<View style={styles.places}>
								<View style={styles.location}>
									<Text style={styles.locationText}>Winslow Hall</Text>
								</View>
								<View style={styles.location}>
									<Text style={styles.locationText}>BUSA House</Text>
								</View>
							</View>
						</View>
						<View style={styles.status}>
							<Text style={styles.statusText}>#200</Text>
							{status ? (
								<Text style={styles.complete}>Completed</Text>
							) : (
								<Text style={styles.cancelled}>Cancelled</Text>
							)}
						</View>
					</View>
				</Shadow>
				</View>
			</View>
		</SafeAreaView>
	);
};

export default History;

const styles = StyleSheet.create({
	container: {
		backgroundColor: colors.secondary2,
		flex: 1,
	},
	headText: {
		color: "black",
		fontSize: 24,
		fontFamily: "Albert-SemiBold",
	},
	bottomContainer: {
		paddingHorizontal: 16,
	},
	monthDate: {
		marginBottom: 18,
		marginTop: 16,
		fontSize: 20,
		fontFamily: "Albert-SemiBold",
	},
	historyContainer: {
		height: 200,
		backgroundColor: "white",
		alignSelf: "center",
		borderRadius: 16,
		padding: 16,
	},
	dayDate: {
		fontSize: 18,
		fontFamily: "Albert-Regular",

	},
	locationCont: {
		alignItems: "center",
		flexDirection: "row",
		marginTop:10
	},
	places: {
		justifyContent: "center",
		marginLeft: 16,
	},
	location: {
		width: "100%",
		paddingVertical: 10,
	},
	locationText: {
		fontFamily: "Albert-Regular",
		fontSize: 16,
	},
	status: {
		width: "100%",
		height: 38,
		backgroundColor: colors.lightGrey2,
		borderRadius: 8,
		marginTop: "auto",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 8,
	},
	statusText: {
		fontSize: 16,
		fontFamily: "Albert-SemiBold",
	},
	complete: {
		color: colors.primaryBlue,
		fontSize: 16,
		fontFamily: "Albert-SemiBold",
	},
	cancelled: {
		color: colors.lightGrey3,
		fontSize: 16,
		fontFamily: "Albert-Regular",
	},
});
