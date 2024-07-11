import { Pressable, StyleSheet, Text, View } from "react-native";
import React from "react";
import { AntDesign } from "@expo/vector-icons";
import { colors } from "../../constants/styling";
import { TextInput } from "react-native-paper";

const RiderHeader = ({Back}) => {
	return (
		<View style={styles.container}>
			<Pressable onPress={Back} style={styles.backButton}>
				<AntDesign name="arrowleft" size={24} color="black" />
			</Pressable>
			<View style={styles.searchBox}>
                <Text>BUSA House</Text>
            </View>
		</View>
	);
};

export default RiderHeader;

const styles = StyleSheet.create({
	container: {
		width: "90%",
		backgroundColor: colors.secondary,
		alignSelf: "center",
		borderRadius: 10,
		position: "absolute",
		top: 40,
		height: 50,
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 8,
	},
    backButton: {
        width: 40,
        height: 40,
        justifyContent: "center",
        alignItems: "center",
    },
    searchBox: {
        width: "88%",
        height: 40,
        backgroundColor: colors.lightGrey2,
        borderRadius: 8,
        justifyContent: "center",
        paddingHorizontal: 16,
        // marginLeft:16,
        flexDirection: "row",
        alignItems: "center",
    }
});
