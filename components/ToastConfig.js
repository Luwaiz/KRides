 import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { colors } from "../constants/styling";
import Toast from "react-native-toast-message";

const closeToast=()=>[
    Toast.hide()
]

const ToastConfig ={
	tomatoToast: ({ text1, text2,props }) => (
		<View style={styles.container}>
			<TouchableOpacity activeOpacity={0.5} onPress={closeToast} style={styles.icon}>
				<Feather name="x" size={20} color="black" />
			</TouchableOpacity>
			<View style={styles.textContainer}>
				<Text style={styles.text1}>{text1}</Text>
				<Text style={styles.text2}>{text2}</Text>
			</View>
		</View>
	)
};

export default ToastConfig;

const styles = StyleSheet.create({
	container: {
		backgroundColor: colors.secondary,
		height: 70,
		width: "90%",
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		borderRadius: 8,
	},
    icon: {
        width: 40,
        height: 40,
        backgroundColor: colors.lightGrey,
        borderRadius: 20,
        justifyContent: "center",
        alignItems: "center",
        marginRight:15
    },
    textContainer: {
        gap:5
    },
    text1: {
        fontSize: 14,
        color: "black",
		fontFamily: "Albert-Regular",
		fontWeight: "light"
    },
    text2: {
		fontSize: 16,
        color: "black",
        fontFamily: "Albert-Regular",
        fontWeight: "bold"
    }
    
});
