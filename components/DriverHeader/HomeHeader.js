import { StatusBar, StyleSheet, Text, View } from "react-native";
import React from "react";
import { Octicons } from "@expo/vector-icons";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import { TouchableOpacity } from "react-native-gesture-handler";
import { colors } from "../../constants/styling";
import Cash from "../../assets/svg/Cash.svg";
import Calendar from "../../assets/svg/Calendar.svg";

const HomeHeader = () => {
	const navigation = useNavigation();
	const OpenDrawer = () => {
		navigation.dispatch(DrawerActions.openDrawer());
	};
	return (
		<View style={styles.container}>
			<TouchableOpacity
				style={styles.drawerNav}
				activeOpacity={0.7}
				onPress={OpenDrawer}
			>
				<View>
					<Octicons name="three-bars" size={24} color="black" />
				</View>
			</TouchableOpacity>
			<View style={styles.box}>
				<Calendar height={25} width={25} />
				<View style={styles.texts}>
					<Text style={styles.text}>
                        Completed Trips
                    </Text>
					<Text style={styles.text2}>
                        10
                    </Text>
				</View>
			</View>
			<View style={styles.box}>
				<Cash height={25} width={25} />
				<View style={styles.texts}>
				<Text style={styles.text}>
                        Earned today
                    </Text>
					<Text style={styles.text2}>
                        N1000
                    </Text>
				</View>
			</View>
		</View>
	);
};

export default HomeHeader;

const styles = StyleSheet.create({
	container: {
		width: "100%",
		height: 100,
		backgroundColor: colors.primary,
		paddingTop: StatusBar.currentHeight + 12,
		flexDirection: "row",
		justifyContent: "center",
	},

	drawerNav: {
		width: 48,
		height: 48,
		backgroundColor: colors.secondary,
		justifyContent: "center",
		alignItems: "center",
		borderRadius: 24,
		marginRight: 10,
	},
	box: {
		width: 140,
		height: 70,
		backgroundColor: colors.secondary,
		marginHorizontal: 5,
		borderRadius: 10,
		alignItems: "center",
		padding:5,
		flexDirection:"row"
	},
	texts:{
		marginLeft:5,
	},
	text:{
		fontSize:12,
		color:colors.lightGrey3,
	},
    text2:{
		fontFamily:"Albert-SemiBold",
		fontSize:14,
		marginTop:5    }
});
