import { Dimensions, StyleSheet, Text, View } from "react-native";
import React, { useState } from "react";
import { colors } from "../constants/styling";
import Direction from "../assets/svg/Frame 34direction.svg";
import { Shadow } from "react-native-shadow-2";
import { formatDate, parseISO } from "date-fns";
const { width, height } = Dimensions.get("screen");

const HistoryCard = ({ history }) => {
	const [status, setStatus] = useState(true);
	console.log(history?.created_at)
	const date =   "000000" ;
	const DateFormat = history ?  formatDate(date, "dd MMMM yyyy"): "000000";
	const time = history ? formatDate(date, "hh:mm a") : "000000";


	return (
		
		<View style={styles.historyContainer}>
		{history !== undefined && <>

			<View style={styles.dateContainer}>
				<Text style={styles.dayDate}>{DateFormat}</Text>
				<Text style={styles.time}>{time}</Text>
			</View>

			<View style={styles.locationCont}>
				<Direction width={40} height={80} />
				<View style={styles.places}>
					<View style={styles.location}>
						<Text style={styles.locationText}>{history?.location}</Text>
					</View>
					<View style={styles.location}>
						<Text style={styles.locationText}>{history?.destination}</Text>
					</View>
				</View>
			</View>
			<View style={styles.dateContainer}>
				<Text style={styles.dayDate}>Rider</Text>
				<Text style={styles.time}>{history?.rider_name}</Text>
			</View>
			<View style={styles.status}>
				<Text style={styles.statusText}># {history?.amount}</Text>
				{status ? (
					<Text style={styles.complete}>Completed</Text>
				) : (
					<Text style={styles.cancelled}>Cancelled</Text>
				)}
			</View>
		</>
		}
		</View>
	);
};

export default HistoryCard;

const styles = StyleSheet.create({
	dateContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginVertical: 5,
	},
	historyContainer: {
		backgroundColor: "white",
		alignSelf: "center",
		borderRadius: 16,
		padding: 16,
		marginVertical: 16,
		width: width - 32,
		borderColor: colors.lightGrey2,
		borderWidth: 2,
	},
	dayDate: {
		fontSize: 18,
		fontFamily: "Albert-Regular",
	},
	locationCont: {
		alignItems: "center",
		flexDirection: "row",
		marginBottom: 10,
	},
	places: {
		justifyContent: "center",
		marginLeft: 10,
        marginTop:10
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
	time: {
		fontSize: 14,
		fontFamily: "Albert-Regular",
		color: colors.lightGrey3,
		marginTop: 4,
		marginBottom: 4,
	},
	rider: {
		marginVertical: 16,
		fontSize: 18,
		fontFamily: "Albert-SemiBold",
	},
});
