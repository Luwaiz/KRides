import { Image, StyleSheet, Text, TextInput, View } from 'react-native'
import React from 'react'
import { AntDesign } from "@expo/vector-icons";
import { colors } from '../constants/styling';


const DestinationPick = () => {
  return (
    <View style={styles.lowerCont}>
    <View style={styles.InputCont}>
        <Image
            source={require("../assets/images/blueDot.png")}
        />
        <TextInput
            style={styles.input}
            placeholder="Choose Pickup Location"
            placeholderTextColor={colors.lightGrey3}
        />
    </View>
    <View style={[styles.InputCont,{alignItems:"center"}]}>
        <Image
            style={styles.redDot}
            source={require("../assets/images/redDot.png")}
        />
        <TextInput
            style={styles.input}
            placeholder="Choose Destination"
            placeholderTextColor={colors.lightGrey3}
        />
        <AntDesign
            style={styles.cancel}
            name="close"
            size={24}
            color={colors.lightGrey4}
        />
    </View>
</View>
  )
}

export default DestinationPick

const styles = StyleSheet.create({
    lowerCont: {
		width: "100%",
		gap: 16,
	},
	InputCont: {
		height: 59,
		backgroundColor: colors.lightGrey2,
		flexDirection: "row",
		borderRadius: 8,
	},
	input: {
		flex: 1,
		height: "100%",
		fontSize:16
	},
	redDot: {
		marginHorizontal: 20,
	},
	cancel:{
		marginHorizontal:18
	}

})