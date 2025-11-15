import { StyleSheet, Text, View } from "react-native";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import WhereTo from "./WhereTo";
import ActiveButton from "./buttons/ActiveButton";
import { colors } from "../constants/styling";
import { sp, fs, br, ms } from "../constants/responsive";
import {
	useBottomTabStore,
	useUserDetails,
	useRideStore,
	useRideDetailsStore,
} from "../constants/Store";
import { formatDate, parseISO } from "date-fns";
import { FIREBASE_AUTH, FIREBASE_DB } from "../firebaseConfig";
import { doc, onSnapshot } from "firebase/firestore";

const HomeTab = () => {
	const Passengers = useBottomTabStore((state) => state.PassengerPage);
	const { firstName } = useUserDetails((state) => ({
		firstName: state.firstName,
	}));
	const { destination, location } = useRideStore((state) => ({
		destination: state.destination,
		location: state.location,
	}));
	const { pickupLocation, destination: destinationCoords } =
		useRideDetailsStore((state) => ({
			pickupLocation: state.pickupLocation,
			destination: state.destination,
		}));
	const date = new Date();
	const dateFormat = formatDate(date, "dd/MM/yyyy");
	const [name, setName] = useState("");
	const [loading, setLoading] = useState(false);

	// Validation: Check if both pickup and destination are selected
	const canContinue =
		location && destination && pickupLocation && destinationCoords;

	const fetchUserProfile = async () => {
		try {
			setLoading(true);
			const auth = FIREBASE_AUTH;
			const db = FIREBASE_DB;
			const user = auth.currentUser;
			if (user) {
				const unsub = onSnapshot(
					doc(db, "users", user.uid),
					(docSnap) => {
						if (docSnap.exists()) {
							setName(docSnap.data()?.name);
						}
						setLoading(false);
					},
					(error) => {
						// Silently handle permission-denied errors (happens during logout)
						if (error.code === "permission-denied") {
							console.log(
								"🔒 Permission denied in HomeTab - user likely logged out"
							);
						} else {
							console.error("❌ Error in HomeTab onSnapshot:", error);
						}
						setLoading(false);
					}
				);

				// cleanup listener on unmount
				return unsub;
			}
		} catch (e) {
			console.error("Error fetching profile:", e);
			setLoading(false);
		}
	};

	useEffect(() => {
		const unsubscribe = fetchUserProfile();
		return () => {
			if (unsubscribe && typeof unsubscribe === "function") {
				unsubscribe();
			}
		};
	}, []); // Only run once on mount
	return (
		<BottomSheet
			snapPoints={["46%"]}
			backgroundStyle={{ borderRadius: 30 }}
			handleComponent={null}
		>
			<BottomSheetScrollView>
				<View style={styles.sheetCont}>
					<View style={styles.topText}>
						<Text style={styles.greet}>
							Hello, <Text style={{ color: colors.primaryBlue }}>{name}</Text>
						</Text>
						<Text style={styles.where}>Where are you going?</Text>
					</View>
					<WhereTo />
					<View style={styles.dateCont}>
						<Feather name="calendar" size={ms(24)} color={colors.primaryBlue} />
						<Text style={styles.date}>{dateFormat}</Text>
					</View>
					{!canContinue && (
						<Text style={styles.helperText}>
							Please select both pickup and destination to continue
						</Text>
					)}
					<View style={styles.button}>
						<ActiveButton
							title={"Continue"}
							onPress={Passengers}
							disabled={!canContinue}
						/>
					</View>
				</View>
			</BottomSheetScrollView>
		</BottomSheet>
	);
};

export default HomeTab;

const styles = StyleSheet.create({
	sheetCont: {
		flex: 1,
		paddingBottom: sp(16),
		paddingTop: sp(30),
		paddingHorizontal: sp(16),
	},
	topText: {
		marginBottom: sp(10),
	},
	greet: {
		fontSize: fs(16),
		fontWeight: "regular",
		color: "black",
		marginBottom: sp(4),
	},
	where: {
		fontSize: fs(24),
		fontWeight: "bold",
		color: "black",
	},
	dateCont: {
		flexDirection: "row",
		marginVertical: sp(16),
		alignItems: "center",
	},
	date: {
		fontSize: fs(16),
		fontWeight: "regular",
		color: "black",
		marginLeft: sp(8),
	},
	helperText: {
		fontSize: fs(14),
		color: colors.lightGrey3,
		textAlign: "center",
		marginTop: sp(8),
		fontStyle: "italic",
	},
	button: {
		marginTop: sp(20),
	},
});
