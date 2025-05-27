import {
	ActivityIndicator,
	FlatList,
	StyleSheet,
	Text,
	View,
} from "react-native";
import BottomSheet, { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import React, { useEffect, useState } from "react";
import ActiveButton from "../buttons/ActiveButton";
import { colors } from "../../constants/styling";
import { useBottomTabStore, useDriverDetails } from "../../constants/Store";
import Avatar from "../../assets/svg/Frame 77avatar.svg";
import DangerButton from "../buttons/DangerButton";
import Destination from "../Destination";
import axios from "axios";
import API from "../../hooks/API";

const HomeTab = () => {
	
	const Accept = useBottomTabStore((state) => state.setAcceptRidePage);
	const accessToken = useDriverDetails((state) => state.accessToken);
	const [loading, setLoading] = useState(false);
	const [rides, setRides] = useState([]);
	const RidesPending = async () => {
		setLoading(true);
		const header = {
			headers: { Authorization: `Bearer ${accessToken}` },
		};
		try {
			const response = await axios.get(API.PendingRides, header);
			console.log(response.data);
			setRides(response?.data?.data);
			setLoading(false);
		} catch (e) {
			console.log(e.response.data.message);
			setLoading(false);
		}
	};
	

	useEffect(() => {
		RidesPending();
	}, []);
	return (
		<BottomSheet
			snapPoints={["76%"]}
			backgroundStyle={{ borderRadius: 30 }}
			handleComponent={null}
		>
			{loading ? (
				<ActivityIndicator />
			) : (
				<View style={styles.sheetCont}>
					<View style={styles.topText}>
						<Text style={styles.where}>Ride request</Text>
					</View>
					<BottomSheetFlatList
						data={rides}
						keyExtractor={(item, index) => index?.toString()}
						renderItem={({ item }) => (
							<View style={styles.container}>
							
							/>
								<View style={styles.details}>
									<Avatar width={50} height={50} />
									<View>
										<Text style={styles.name}>{item?.name}</Text>
										<Text style={styles.time}>Passengers: {item?.number_of_passengers}</Text>
										<Text style={styles.time}>N{item?.amount}</Text>
									</View>
								</View>
								<Destination location={item?.location} destination={item?.destination} />
								<View style={styles.button}>
									<DangerButton title={"Decline"} />
									<ActiveButton title={"Accept"} onPress={Accept} />
								</View>
							</View>
						)}
					/>
				</View>
			)}
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
	container:{
		marginBottom:30
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
		marginTop: 20,
		flexDirection: "row",
		justifyContent: "space-between",
	},
});
