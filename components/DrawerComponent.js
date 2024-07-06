import { StyleSheet, Text, View } from "react-native";
import { DrawerContentScrollView, DrawerItem } from "@react-navigation/drawer";
import React, { useState } from "react";
import { AntDesign } from "@expo/vector-icons";
import { Foundation } from "@expo/vector-icons";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/styling";
import { useNavigation } from "@react-navigation/native";
import { TouchableOpacity } from "react-native-gesture-handler";
import Confirmation1 from "./modals/Confirmation1";
import Avatar from "../assets/svg/Frame 77avatar.svg";

const details = [
	{
		icon: <AntDesign name="clockcircle" size={25} color={colors.IconGrey} />,
		title: "Ride history",
		navgateTo: "History",
	},
	{
		icon: <AntDesign name="questioncircle" size={24} color={colors.IconGrey} />,
		title: "Support",
		navgateTo: "Support",
	},
	{
		icon: <Foundation name="info" size={30} color={colors.IconGrey} />,
		title: "About",
		navgateTo: "About",
	},
	{
		icon: <Ionicons name="log-out-sharp" size={24} color={colors.IconGrey} />,
		title: "Logout",
	},
	{
		icon: <AntDesign name="delete" size={24} color={"red"} />,
		title: "Delete Account",
	},
];
const DrawerLayout = ({ icon, title, navgateTo }) => {
	const navigation = useNavigation();
	const [modal, setModal] = useState(false);
	return (
		<>
			<DrawerItem
				labelStyle={title === "Delete Account" && styles.label}
				style={styles.items}
				icon={() => icon}
				label={title}
				onPress={
					title === "Logout" || title === "Delete Account"
						? () => setModal(true)
						: () => navigation.navigate(navgateTo)
				}
			/>
			<Confirmation1 modal={modal} setModal={setModal} title={title} />
		</>
	);
};

const DrawerContent = (props) => {
	return details.map((item, i) => {
		return (
			<DrawerLayout
				key={i}
				title={item.title}
				navgateTo={item.navgateTo}
				icon={item.icon}
			/>
		);
	});
};

const DrawerComponent = (props) => {
	const navigation = useNavigation();

	return (
		<View style={{ flex: 1 }}>
			<DrawerContentScrollView {...props}>
				<TouchableOpacity onPress={() => navigation.navigate("Profile")}>
					<View style={styles.topCont}>
						<View>
							<Avatar />
						</View>
						<View style={styles.container}>
							<Text style={styles.title}>Tobi</Text>
							<Text style={styles.subTitle}>Edit Profile</Text>
						</View>
					</View>
				</TouchableOpacity>
				<View style={styles.bottomCont}>
					<DrawerContent />
				</View>
			</DrawerContentScrollView>
		</View>
	);
};

export default DrawerComponent;

const styles = StyleSheet.create({
	container: {},
	topCont: {
		flexDirection: "row",
		marginHorizontal: 15,
		paddingVertical: 10,
		gap: 16,
		borderBottomWidth: 1,
		borderBottomColor: colors.lightGrey,
		alignItems: "center",
	},
	title: {
		fontFamily: "Albert-SemiBold",
		fontSize: 16,
	},
	subTitle: {
		fontFamily: "Albert-Light",
		color: colors.primaryBlue,
		fontSize: 16,
	},
	items: {
		margin: 0,
		padding: 0,
		gap: 0,
	},
	label: {
		margin: 0,
		padding: 0,
		gap: 0,
		color: "red",
	},
	bottomCont: {
		borderBottomWidth: 1,
		borderBottomColor: colors.lightGrey,
		marginHorizontal: 15,
	},
});
