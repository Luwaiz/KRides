import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React from "react";
import { colors } from "../../constants/styling";

//active button component
const GoogleButton = ({title,onPress}) => {
	return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.5}>
        <View style={styles.button}>
        <Image source={require("../../assets/images/Google svg.png")} resizeMode="cover" style={styles.google}/>
            <Text style={styles.buttonText}>{title}</Text>
        </View>
    </TouchableOpacity>
    )
};

export default GoogleButton;

const styles = StyleSheet.create({
    button: {
        backgroundColor: colors.secondary,
        minWidth: 167,
        height: 48,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        borderWidth:1,
        borderColor:colors.lightGrey,
        marginTop:8,
        flexDirection:"row"
    },
    buttonText: {
        color: colors.lightGrey,
        fontSize: 16,
        fontWeight: "400",
    },
    google:{
        width:20,
        height:20,
        marginRight:5,
        alignSelf:"center"
    }
});
