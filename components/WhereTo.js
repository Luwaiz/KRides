import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React from 'react'
import { colors } from '../constants/styling'
import { useNavigation } from '@react-navigation/native'

const WhereTo = () => {
    const navigation = useNavigation()
    const ToPickDestination = () => {
		navigation.navigate("Destinations");
	};

  return (
    <View style={styles.locations}>
        <Image source={require("../assets/images/paths.png")} style={{height:"auto",marginBottom:10}} resizeMode="contain"/>
    <View style={styles.destinations}>
<TouchableOpacity activeOpacity={0.7} onPress={ToPickDestination}>
        <View style={styles.destination}>
            <Text style={styles.destinationText}>
                Choose Pickup Location
            </Text>
        </View>
</TouchableOpacity>
<TouchableOpacity activeOpacity={0.7} onPress={ToPickDestination}>
        <View style={styles.destination}>
            <Text style={styles.destinationText}>Choose Destination</Text>
        </View>
</TouchableOpacity>
    </View>
</View>
  )
}

export default WhereTo

const styles = StyleSheet.create({
    locations: {
		alignSelf: "center",
		backgroundColor: colors.lightGrey2,
		width: "100%",
		height: 140,
		borderRadius: 16,
		flexDirection: "row",
		paddingVertical:16,
		// justifyContent: "center",
	},
	pointers: {
		width: 34,
		height: "100%",
	},
	destinations: {
		minWidth: 270,
		height: "100%",
		justifyContent: "space-between",
	},
	destination: {
		width: "100%",
		minHeight: 48,
		backgroundColor: colors.secondary,
		borderRadius: 8,
		padding: 8,
		justifyContent: "center",
	},
	destinationText: {
		fontSize: 16,
		fontWeight: "regular",
		color: "black",
	},
})