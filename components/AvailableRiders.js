import {
	ActivityIndicator,
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
import { useBottomTabStore, useRideStore } from "../constants/Store";
import { collection, getDocs, query, where } from "firebase/firestore";
import InActiveButton from "./buttons/InActiveButton";
import { FIREBASE_DB } from "../firebaseConfig";

const AvailableRiders = () => {
	const [selectedRider, setSelectedRider] = useState(null);
	const [loading, setLoading] = useState(false);
	const [riders, setRiders] = useState([]);

	const confirm = useBottomTabStore((state) => state.setConfirmPage);
	const { setRider } = useRideStore((state) => ({
		setRider: state.setRider,
	}));

	useEffect(() => {
		(async () => {
			try {
				const snapshot = await getDocs(collection(FIREBASE_DB, "drivers"));
				console.log("Drivers fetched:", snapshot.docs.length);
			} catch (e) {
				console.log("Firestore test error:", e);
			}
		})();
	}, []);
	const GetRiders = async () => {
		setLoading(true);
		try {
			const q = query(
				collection(FIREBASE_DB, "drivers")
				// where("status", "==", "available")
			);
			const snapshot = await getDocs(q);

			const driverList = snapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}));

			console.log(driverList);
			setRiders(driverList);
		} catch (error) {
			console.error("Error fetching riders:", error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		GetRiders();
	}, []);

	const Selected = (id, name) => {
		setSelectedRider(id);
		setRider(name);
	};

	return (
		<View style={styles.bottomSheet}>
			<View style={styles.sheetCont}>
				{loading ? (
					<ActivityIndicator color={colors.primaryBlue} size={30} />
				) : riders?.length === 0 ? (
					<Text
						style={{
							textAlign: "center",
							color: colors.lightGrey3,
							fontSize: 16,
						}}
					>
						Sorry, no drivers available.
					</Text>
				) : (
					<FlatList
						data={riders}
						keyExtractor={(item) => item.id}
						renderItem={({ item }) =>
							renderItems(item, Selected, selectedRider)
						}
						showsVerticalScrollIndicator={false}
					/>
				)}
				<View style={styles.button}>
					{riders?.length === 0 ? (
						<InActiveButton title={"Select Rider"} />
					) : (
						<ActiveButton
							disabled={selectedRider === null}
							title={"Select Rider"}
							onPress={confirm}
						/>
					)}
				</View>
			</View>
		</View>
	);
};

const renderItems = (item, Selected, selectedRider) => {
	return (
		<Pressable
			onPress={() => Selected(item.id, item.fullname)}
			style={[
				styles.container,
				{
					borderColor: selectedRider === item.id ? colors.primaryBlue : "white",
				},
			]}
		>
			<Avatar width={50} height={50} />
			<View style={styles.driverDetails}>
				<Text style={styles.driverName}>{item.fullname}</Text>
				<View style={styles.info}>
					<Text>{item.vehicle_id}</Text>
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
		height: 400,
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
});
