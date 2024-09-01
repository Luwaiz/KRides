import {
	Dimensions,
	FlatList,
	Image,
	StyleSheet,
	Text,
	View,
} from "react-native";
import React, { useRef, useState } from "react";
import { OnBoard } from "../constants/OnBoardData";
import BottomSheet from "@gorhom/bottom-sheet";
import Footer from "../components/Footer";
const { width, height } = Dimensions.get("screen");

const OnBoarding = ({ navigation }) => {
	const [currentIndex, setCurrentIndex] = useState(0);
	const slideRef = useRef(null);
	// function for detecting the current page and updating indicator Bar
	const scrollFunction = (e) => {
		// console.log(e.nativeEvent.contentOffset.x);
		const contentOffsetX = e.nativeEvent.contentOffset.x;
		setCurrentIndex(Math.round(contentOffsetX / width));
	};
	//Next button function
	const NextPage = () => {
		const nextSlide = currentIndex + 1;
		if (nextSlide < OnBoard.length) {
			const offset = nextSlide * width;
			slideRef?.current?.scrollToOffset({ offset });
			setCurrentIndex(nextSlide);
		}
	};
	// Skip button function
	const SkipPage = () => {
		navigation.replace("AuthStack", {
			params: "AuthScreen",
		});
	};

	// function to navigate to home screen
	const navigateToHome = () => {
		navigation.replace("AuthStack", {
			params: "AuthScreen",
		});
	};

	return (
		<View style={styles.container}>
			<FlatList
				ref={slideRef}
				data={OnBoard}
				horizontal
				scrollEnabled
				onMomentumScrollEnd={scrollFunction}
				pagingEnabled
				style={{ flex: 0.65 }}
				showsHorizontalScrollIndicator={false}
				renderItem={({ item }) => (
					<>
						<Image
							source={item.image}
							style={styles.image}
							resizeMode="cover"
						/>
						<BottomSheet
							style={styles.Sheet}
							handleComponent={null}
							backgroundStyle={{ borderRadius: 30 }}
							snapPoints={["35%"]}
						>
							<View style={styles.contain}>
								<Text style={styles.title}>{item.title}</Text>
								<Text style={styles.subTitle}>{item.subTitle}</Text>
							</View>
						</BottomSheet>
					</>
				)}
			/>
			<Footer
				currentIndex={currentIndex}
				setCurrentIndex={setCurrentIndex}
				NextPage={NextPage}
				SkipPage={SkipPage}
				navigateToHome={navigateToHome}
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
		textAlign: "center",
		marginBottom: 30,
		fontFamily: "Albert-SemiBold",
	},
	subTitle: {
		fontSize: 16,
		textAlign: "center",
		flexWrap: "wrap",
		maxWidth: width - 120,
		lineHeight: 20,
	},
	Sheet: {
		shadowColor: "#000",
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
		elevation: 200,
	},
});
