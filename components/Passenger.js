import { StyleSheet, Text, View } from "react-native";
import BottomSheet from "@gorhom/bottom-sheet";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import WhereTo from "./WhereTo";
import ActiveButton from "./buttons/ActiveButton";
import { colors } from "../constants/styling";
import { RadioButton } from "react-native-paper";

const Passenger = () => {
	const [selected, setSelected] = useState();
	return (
		<BottomSheet
			snapPoints={["40%"]}
			backgroundStyle={{ borderRadius: 30 }}
			handleComponent={null}
		>
			<View style={styles.sheetCont}>
            <Text style={styles.where}>Select number of passengers</Text>

				<View style={styles.RadioContainer}>
					<RadioButton.Android
						value="1"
                        status={selected === "1"? "checked" :"unchecked"}
						onPress={() => setSelected("1")}
						color={colors.primaryBlue}
					/>
					<Text>1 Passenger</Text>
				</View>
                <View style={styles.RadioContainer}>
					<RadioButton.Android
						value="2"
                        status={selected === "2"? "checked" :"unchecked"}
						onPress={() => setSelected("2")}
						color={colors.primaryBlue}
                        
					/>
					<Text>2 Passengers</Text>
				</View>
                <View style={styles.RadioContainer}>
					<RadioButton.Android
						value="3"
                        status={selected === "3"? "checked" :"unchecked"}
						onPress={() => setSelected("3")}
						color={colors.primaryBlue}
                        
					/>
					<Text>3 Passengers</Text>
				</View>
                <View style={styles.RadioContainer}>
					<RadioButton.Android
						value="4"
                        status={selected === "4"? "checked" :"unchecked"}
						onPress={() => setSelected("4")}
						color={colors.primaryBlue}
                        
					/>
					<Text>4 Passengers</Text>
				</View>

				<View style={styles.button}>
					<ActiveButton title={"Search"} />
				</View>
			</View>
		</BottomSheet>
	);
};

export default Passenger;

const styles = StyleSheet.create({
	sheetCont: {
		flex: 1,
		paddingBottom: 16,
		paddingTop: 30,
		paddingHorizontal: 16,
	},
	RadioContainer: {
		flexDirection: "row",
		alignItems: "center",
	},
	greet: {
		fontSize: 16,
		fontWeight: "regular",
		color: "black",
		marginBottom: 4,
	},
	where: {
		fontSize: 24,
		fontWeight: "bold",
		color: "black",
        marginBottom: 20,
	},
	dateCont: {
		flexDirection: "row",
		marginVertical: "auto",
		alignItems: "center",
	},
	date: {
		fontSize: 16,
		fontWeight: "regular",
		color: "black",
	},
	button: {
		marginTop: "auto",
	},
});
