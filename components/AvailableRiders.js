import {
	ActivityIndicator,
	Dimensions,
	FlatList,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import React, { useEffect, useState } from "react";
import ActiveButton from "./buttons/ActiveButton";
import { colors } from "../constants/styling";
import Avatar from "../assets/svg/Frame 77avatar.svg";
import {
	useBottomTabStore,
	useRideStore,
	useUserDetails,
} from "../constants/Store";
import axios from "axios";
import API from "../hooks/API";
const { width, height } = Dimensions.get("window");

const AvailableRiders = () => {
	const [selectedRider, setSelectedRider] = useState(null);
	const [loading, setLoading] = useState(false);
	const [riders, setRiders] = useState(null);
	const accessToken = useUserDetails((state) => state?.accessToken);
	const confirm = useBottomTabStore((state) => state.setConfirmPage);
	const { setRider } = useRideStore((state) => ({
		setRider: state.setRider,
	}));

	const GetRiders = async () => {
		setLoading(true);
		const header = {
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		};
		try {
			const response = await axios.get(API.ListOfRiders, header);
			console.log("available riders", response.data)
			setRiders(response.data);
			setLoading(false);
		} catch (error) {
			console.log("Error fetching riders: ", error.response.data.response);
			setLoading(false);
		}
	};

	useEffect(() => {
		GetRiders();
	}, []);

	const Selected = (id, name) => {
		
		setSelectedRider(id);
		console.log("Selected Rider: ", id, name);
		setRider(name);
	};

	return (
		<View style={styles.bottomSheet}>
			<View style={styles.sheetCont}>
				{loading ? (
					<ActivityIndicator color={colors.primaryBlue} size={30} />
				) : (
					<FlatList
						data={riders || null}
						keyExtractor={(item, index) => index.toString()}
						renderItem={({ item, index }) =>
							renderItems(item, index, Selected, selectedRider)
						}
						showsVerticalScrollIndicator={false}
					/>
				)}
				<View style={styles.button}>
					<ActiveButton
						disabled={selectedRider === null}
						title={"Select Rider"}
						onPress={confirm}
					/>
				</View>
			</View>
		</View>
	);
};

const renderItems = (item, index, Selected, selectedRider) => {
	return (
		<Pressable
			onPress={() => Selected(index, item?.name)}
			style={[
				styles.container,
				{
					borderColor: selectedRider === index ? colors.primaryBlue : "white",
				},
			]}
		>
			<Avatar width={50} height={50} />
			<View style={styles.driverDetails}>
				<Text style={styles.driverName}>{item?.name}</Text>
				<View style={styles.info}>
					<Text>{item?.vehicle_id}</Text>
				</View>
			</View>
		</Pressable>
	);
};

export default AvailableRiders;

const styles = StyleSheet.create({
	bottomSheet: {
		backgroundColor: colors.secondary2,
		borderTopLeftRadius: 30,
		borderTopRightRadius: 30,
		height: height / 2,
		position: "absolute",
		bottom: 0,
		left: 0,
		right: 0,
	},
	sheetCont: {
		flex: 1,
		paddingBottom: 16,
		paddingTop: 30,
		paddingHorizontal: 16,
	},
	button: {
		paddingTop: 10,
	},
	container: {
		width: "100%",
		padding: 10,
		borderRadius: 16,
		borderWidth: 2,
		marginBottom: 10,
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
		backgroundColor: colors.lightGrey,
	},
	driverDetails: {
		flex: 1,
		marginHorizontal: 16,
	},
	driverName: {
		fontFamily: "Albert-SemiBold",
		fontSize: 16,
	},
	info: {
		flexDirection: "row",
		alignItems: "center",
		marginTop: 8,
		gap: 12,
	},
	price: {
		fontSize: 16,
		fontFamily: "Albert-SemiBold",
	},
});
