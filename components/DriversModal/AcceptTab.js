import { StyleSheet, Text, View } from "react-native";
import BottomSheet from "@gorhom/bottom-sheet";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import Phone from "../../assets/svg/Call.svg";
import ActiveButton from "../buttons/ActiveButton";
import { colors } from "../../constants/styling";
import { useBottomTabStore } from "../../constants/Store";
import Avatar from "../../assets/svg/Frame 77avatar.svg";
import Arrival from "../modals/Arrival";

const AcceptTab = () => {
	const [endRide, setEndRide] = useState(false);

	const RideEnded = () => {
		setEndRide(true);
	};
	return (
		<>
			<BottomSheet
				snapPoints={["26%"]}
				backgroundStyle={{ borderRadius: 30 }}
				handleComponent={null}
			>
				<View style={styles.sheetCont}>
					<View style={styles.topText}>
						<Text style={styles.where}>Ride request</Text>
						<Text style={styles.time}>2 mins away</Text>
					</View>
					<View style={styles.details}>
						<View style={styles.detailCont}>
							<Avatar width={50} height={50} />
							<View>
								<Text style={styles.name}>Henry</Text>
								<Text style={styles.time}>Cash payment</Text>
								<Text style={styles.time}>N150</Text>
							</View>
						</View>
						<Phone width={24} height={24} />
					</View>

					<View style={styles.button}>
						<ActiveButton title={"continue"} onPress={RideEnded} />
					</View>
				</View>
			</BottomSheet>
			<Arrival modal={endRide} setModal={setEndRide} />
		</>
	);
};

export default AcceptTab;

const styles = StyleSheet.create({
	sheetCont: {
		flex: 1,
		paddingBottom: 16,
		paddingTop: 30,
		paddingHorizontal: 16,
	},
	topText: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 16,
	},
	time: {
		color: colors.lightGrey3,
		fontSize: 14,
	},
	details: {
		alignItems: "center",
		marginBottom: 16,
		flexDirection: "row",
		gap: 10,
		justifyContent: "space-between",
	},
	detailCont: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
	},
	where: {
		fontSize: 24,
		fontWeight: "bold",
		color: "black",
	},
	name: {
		fontFamily: "Albert-SemiBold",
		fontSize: 16,
	},
	button: {
		marginTop: "auto",
	},
});
