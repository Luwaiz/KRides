import { StatusBar, StyleSheet, Text, View, Switch } from "react-native";
import React, { useEffect, useState } from "react";
import { Octicons } from "@expo/vector-icons";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import { TouchableOpacity } from "react-native-gesture-handler";
import { colors } from "../../constants/styling";
import Cash from "../../assets/svg/Cash.svg";
import Calendar from "../../assets/svg/Calendar.svg";
import { getDriverTodayStats } from "../../helpers/driverStats";
import { useDriverDetails, useDriverAvailability } from "../../constants/Store";

const HomeHeader = () => {
	const navigation = useNavigation();
	const [completedTrips, setCompletedTrips] = useState(0);
	const [earnedToday, setEarnedToday] = useState(0);

	// Get driver ID from store
	const uid = useDriverDetails((state) => state.uid);
	const driverId = uid;

	// Online/Offline status
	const isOnline = useDriverAvailability((state) => state.isOnline);
	const toggleAvailability = useDriverAvailability((state) => state.toggleAvailability);

	const OpenDrawer = () => {
		// Open the drawer instead of navigating to settings
		navigation.dispatch(DrawerActions.openDrawer());
	};

	const fetchDriverStats = async () => {
		if (!driverId) {
			console.log("⚠️ No driver ID available yet");
			return;
		}

		try {
			const stats = await getDriverTodayStats(driverId);
			setCompletedTrips(stats.completedTrips);
			setEarnedToday(stats.earnedToday);
		} catch (error) {
			console.log("Error fetching driver stats:", error);
		}
	};

	useEffect(() => {
		fetchDriverStats();
	}, [driverId]);
	return (
		<View style={styles.container}>
			{/* First Row: Menu and Toggle */}
			<View style={styles.topRow}>
				<TouchableOpacity
					style={styles.drawerNav}
					activeOpacity={0.7}
					onPress={OpenDrawer}
				>
					<View>
						<Octicons name="three-bars" size={24} color="black" />
					</View>
				</TouchableOpacity>

				{/* Online/Offline Toggle */}
				<View style={styles.statusBox}>
					<Text style={styles.statusText}>
						{isOnline ? '🟢 Online' : '🔴 Offline'}
					</Text>
					<Switch
						value={isOnline}
						onValueChange={toggleAvailability}
						trackColor={{ false: '#ccc', true: '#4caf50' }}
						thumbColor={isOnline ? '#fff' : '#f4f3f4'}
					/>
				</View>
			</View>

			{/* Second Row: Stats */}
			<View style={styles.statsRow}>
				<View style={styles.box}>
					<Calendar height={24} width={24} />
					<View style={styles.texts}>
						<Text style={styles.text}>Trips</Text>
						<Text style={styles.text2}>{completedTrips}</Text>
					</View>
				</View>
				<View style={styles.box}>
					<Cash height={24} width={24} />
					<View style={styles.texts}>
						<Text style={styles.text}>Earned</Text>
						<Text style={styles.text2}>₦{earnedToday}</Text>
					</View>
				</View>
			</View>
		</View>
	);
};

export default HomeHeader;

const styles = StyleSheet.create({
	container: {
		width: "100%",
		minHeight: 140,
		backgroundColor: colors.primary,
		paddingTop: StatusBar.currentHeight + 12,
		paddingHorizontal: 16,
		paddingBottom: 12,
	},
	topRow: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 10,
		gap: 10,
	},
	statsRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		flex: 1,
	},
	drawerNav: {
		width: 48,
		height: 48,
		backgroundColor: colors.secondary,
		justifyContent: "center",
		alignItems: "center",
		borderRadius: 24,
	},
	box: {
		flex: 1,
		height: 60,
		backgroundColor: colors.secondary,
		borderRadius: 10,
		alignItems: "center",
		padding: 8,
		flexDirection: "row",
		justifyContent: "center",
	},
	texts: {
		marginLeft: 8,
		flex: 1,
	},
	text: {
		fontSize: 11,
		color: colors.lightGrey3,
	},
	text2: {
		fontFamily: "Albert-SemiBold",
		fontSize: 14,
		marginTop: 2,
	},
	statusBox: {
		flex: 1,
		height: 48,
		backgroundColor: colors.secondary,
		borderRadius: 10,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 8,
	},
	statusText: {
		fontSize: 12,
		fontWeight: '600',
		marginBottom: 2,
	},
});
