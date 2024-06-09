import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React from "react";
import { AntDesign } from "@expo/vector-icons";
import { colors } from "../../constants/styling";
import { useNavigation } from "@react-navigation/native";
const {width, height} =Dimensions.get("screen")


const BackButton = ({text}) => {
	const navigation = useNavigation();
	const goBack = () => {
		navigation.goBack();
	};
	//back button component
	return (
        <View style={styles.headCont}>
		<TouchableOpacity activeOpacity={0.8} onPress={goBack}>
			<View style={styles.back}>
				<AntDesign name="arrowleft" size={24} color="black" />
			</View>
		</TouchableOpacity>
        {text}
        </View>
	);
};

export default BackButton;

const styles = StyleSheet.create({
    headCont: {
		width,
		paddingHorizontal: 16,
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
	},
	back: {
		width: 48,
		height: 48,
		borderRadius: 50,
		backgroundColor: colors.lightGrey2,
		alignItems: "center",
		justifyContent: "center",
	},
});
