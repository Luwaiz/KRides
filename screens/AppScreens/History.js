import { Dimensions, FlatList, StyleSheet, Text, View } from "react-native";
import React, { useEffect, useState } from "react";
import { colors } from "../../constants/styling";
import { SafeAreaView } from "react-native-safe-area-context";
import BackButton from "../../components/buttons/BackButton";
import HistoryCard from "../../components/HistoryCard";
import axios from "axios";
import API from "../../hooks/API";
import { useUserDetails } from "../../constants/Store";
import { ActivityIndicator } from "react-native-paper";
const { width, height } = Dimensions.get("screen");

const History = () => {
	const [loading, setLoading] = useState(false);
	const [history, setHistory] = useState();
	const accessToken = useUserDetails((state) => state?.accessToken);
	const currentMonth = new Date();
	const currentMonthName = currentMonth.toLocaleString("default", {
		month: "long",
		year: "numeric",
	});

	const getHistory = async () => {
		setLoading(true);
		const header = {
			headers: { Authorization: `Bearer ${accessToken}` },
		};
		try {
			const response = await axios.get(API.RideHistory, header);
			console.log("history",response?.data)
			setHistory(response?.data?.data);
			setLoading(false);
		} catch (error) {
			console.log(error.response.data.message);
			if(error.response.data.message === "No trips found for the authenticated user."){
				
			}
			setLoading(false);
		}
	};
	useEffect(() => {
		getHistory();
	}, []);
	return (
		<SafeAreaView style={styles.container}>
			<BackButton text={<Text style={styles.headText}>Ride history</Text>} />
			{loading ? (
				<ActivityIndicator
					size={30}
					color={colors.primaryBlue}
					style={{ marginTop: 20 }}
				/>
			) : (
				<FlatList
					data={history ? history.reverse() : []}
					keyExtractor={(item, index) => index.toString()}
					renderItem={({ item, index }) => <HistoryCard history={item} />}
					//using footer component because the flat_list has been inverted
					ListHeaderComponent={
						<Text style={styles.monthDate}>{currentMonthName}</Text>
					}
					contentContainerStyle={styles.contentContainer}
					style={{ width }}
				/>
			)}
		</SafeAreaView>
	);
};

export default History;

const styles = StyleSheet.create({
	container: {
		backgroundColor: colors.secondary2,
		flex: 1,
		alignItems: "center",
	},
	headText: {
		color: "black",
		fontSize: 24,
		fontFamily: "Albert-SemiBold",
	},
	monthDate: {
		marginTop: 20,
		fontSize: 20,
		fontFamily: "Albert-SemiBold",
	},
	contentContainer: {
		paddingHorizontal: 16,
	},
});
