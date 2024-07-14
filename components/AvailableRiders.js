import { Pressable, StyleSheet, Text, View } from "react-native";
import BottomSheet, { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import WhereTo from "./WhereTo";
import ActiveButton from "./buttons/ActiveButton";
import { colors } from "../constants/styling";
import Avatar from "../assets/svg/Frame 77avatar.svg";
import Person from "../assets/svg/Person.svg";
import { useBottomTabStore } from "../constants/Store";

const AvailableRiders = () => {
	const [selectedRider, setSelectedRider] = useState(null);
	const confirm = useBottomTabStore((state)=>state.setConfirmPage)
	


	const Selected = (id) => {
		setSelectedRider(id);
		console.log("Selected Rider: ", id);
	};
	const data = [
		{ name: "Rider 1", distance: "1.2 km", time: "20 min", price: "#10" },
		{ name: "Rider 2", distance: "1.5 km", time: "25 min", price: "#15" },
		{ name: "Rider 3", distance: "1.8 km", time: "30 min", price: "#20" },
		{ name: "Rider 4", distance: "2.1 km", time: "35 min", price: "#25" },
		{ name: "Rider 5", distance: "2.4 km", time: "40 min", price: "#30" },
		{ name: "Rider 6", distance: "2.7 km", time: "45 min", price: "#35" },
		{ name: "Rider 7", distance: "3.0 km", time: "50 min", price: "#40" },
	];
	return (
		<BottomSheet
			snapPoints={["46%"]}
			backgroundStyle={{ borderRadius: 30 }}
			handleComponent={null}
		>
			<View style={styles.sheetCont}>
				<BottomSheetFlatList
					data={data}
					keyExtractor={(item, index) => index.toString()}
					renderItem={({ item, index }) =>
						renderItems(item, index, Selected, selectedRider)
					}
					showsVerticalScrollIndicator={false}
				/>
				<View style={styles.button}>
					<ActiveButton title={"Select Rider"} onPress={confirm}/>
				</View>
			</View>
		</BottomSheet>
	);
};

const renderItems = (item, index, Selected, selectedRider) => {
	return (
		<Pressable
			onPress={() => Selected(index)}
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
					<Text>{item.distance}</Text>
					<View style={{ flexDirection: "row", alignItems: "center" }}>
						<Person width={16} height={16} />
						<Text>1</Text>
					</View>
				</View>
			</View>
			<Text style={styles.price}>{item?.price}</Text>
		</Pressable>
	);
};

export default AvailableRiders;

const styles = StyleSheet.create({
	sheetCont: {
		flex: 1,
		paddingBottom: 16,
		paddingTop: 30,
		paddingHorizontal: 16,
	},
	button: {
		marginTop: "auto",
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
