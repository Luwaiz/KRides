import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import React from "react";
import { AntDesign } from "@expo/vector-icons";
import { Fontisto } from '@expo/vector-icons';
import { colors } from "../../constants/styling";
import { SafeAreaView } from "react-native-safe-area-context";
import DestinationPick from "../../components/destinationPick";

const PickDestination = ({navigation}) => {

	const GoBack=()=>{
		navigation.goBack()
	}
	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.topCont}>
				<View style={styles.headCont}>
				<TouchableOpacity onPress={GoBack}>
				<Fontisto name="close-a" size={18} color="black" />
				</TouchableOpacity>
					<Text style={styles.headText}>Where are you going?</Text>
				</View>
				<DestinationPick/>
			</View>
		</SafeAreaView>
	);
};

export default PickDestination;

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	topCont: {
		height: 258,
		backgroundColor: colors.secondary,
		padding: 16,
	},
	headCont: {
		flexDirection: "row",
		gap: 10,
		marginBottom: 14,
		alignItems: "center",
	},
	headText: {
		fontSize: 24,
		fontWeight: "600",
		color: "black",
	},
});
