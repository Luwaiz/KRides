import { StyleSheet, Text, View } from "react-native";
import { DrawerContentScrollView, DrawerItem } from "@react-navigation/drawer";
import React from "react";
import { AntDesign } from "@expo/vector-icons";
import { Foundation } from "@expo/vector-icons";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, Title } from "react-native-paper";
import { colors } from "../constants/styling";
import { useNavigation } from "@react-navigation/native";
import { TouchableOpacity } from "react-native-gesture-handler";

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
	return (
		<DrawerItem
            labelStyle={styles.label}
			style={styles.items}
			icon={() => icon}
			label={title}
			onPress={
				title === "Logout" || title === "Delete Account"
					? null
					: () => navigation.navigate(navgateTo)
			}
		/>
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
							<Avatar.Image
								source={require("../assets/images/Frame 77avatar.png")}
								size={60}
							/>
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
		width: "100%",
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
    label:{
        margin: 0,
		padding: 0,
		gap: 0,
    },
    bottomCont: {
		borderBottomWidth: 1,
		borderBottomColor: colors.lightGrey,
        marginHorizontal: 15,
    },
});
