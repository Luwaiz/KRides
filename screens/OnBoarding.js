import { Dimensions, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React from "react";
import AppIntroSlider from "react-native-app-intro-slider";
import { OnBoard } from "../constants/OnBoardData";
import { colors } from "../constants/styling";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import ActiveButton from "../components/ActiveButton";
import InActiveButton from "../components/InActiveButton";
import Indicator from "../components/Indicator";
const { width, height } = Dimensions.get("screen");

const OnBoarding = () => {
	return (
		<View style={styles.container}>
		<FlatList
			data={OnBoard}
			horizontal
			pagingEnabled
		    showsHorizontalScrollIndicator={false}
			renderItem={({item})=>(
				<>
						<Image
							source={item.image}
							style={styles.image}
							resizeMode="cover"
						/>
						<BottomSheet style={styles.Sheet} handleComponent={null} snapPoints={["50%"]}>
							<View style={styles.contain}>
								<Text style={styles.title}>{item.title}</Text>
								<Text style={styles.subTitle}>{item.subTitle}</Text>
								<ActiveButton title={"Next"}/>
								<InActiveButton title={"Skip"}/>
								<Indicator item={OnBoard}/>
							</View>
						</BottomSheet>
					</>
			)}
		/>
		</View>
	);
};

export default OnBoarding;

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	image: {
		width: width,
		height: height / 2,
	},
	contain: {
		flex: 1,
		alignItems: "center",
		paddingVertical: 40,
	},
	title: {
		fontSize: 24,
		fontWeight: "bold",
		textAlign: "center",
		marginBottom: 30,
	},
	subTitle: {
		fontSize: 16,
		textAlign: "center",
		flexWrap: "wrap",
		maxWidth: width - 120,
        marginBottom: 50,
		lineHeight:20
	},	
	Sheet:{
		shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 10,
	}
});
