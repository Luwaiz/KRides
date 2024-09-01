import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React from "react";
import { colors } from "../../constants/styling";

//active button component
const DangerButton = ({title,onPress}) => {
	return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.5}>
        <View style={styles.button}>
            <Text style={styles.buttonText}>{title}</Text>
        </View>
    </TouchableOpacity>
    )
};

export default DangerButton;

const styles = StyleSheet.create({
    button: {
        backgroundColor: colors.lightGrey2,
        minWidth: 167,
        height: 48,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
    },
    buttonText: {
        color: "red",
        fontSize: 16,
        fontWeight: "500",
    },
});
