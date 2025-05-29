import {
	Dimensions,
	Pressable,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import BottomSheet from "@gorhom/bottom-sheet";
import React, { useEffect, useState } from "react";
import ActiveButton from "./buttons/ActiveButton";
import { colors } from "../constants/styling";
import { useNavigation } from "@react-navigation/native";
import { Entypo } from "@expo/vector-icons";
import Avatar from "../assets/svg/Frame 77avatar.svg";
import Phone from "../assets/svg/Call.svg";
import Star from "../assets/svg/Rating.svg";
import Direction from "../assets/svg/Frame 34direction.svg";
import Naira from "../assets/svg/Naira.svg";
import RideConfirm from "./modals/RideConfirm";
import { useRideStore, useUserDetails } from "../constants/Store";
import axios from "axios";
import API from "../hooks/API";
import socket from "../hooks/Socket";
import InActiveButton from "./buttons/InActiveButton";
import DangerButton from "./buttons/DangerButton";

const ConfirmRide = () => {
	const navigation = useNavigation();
	const [selectRider, createRide] = useState(false);
	const [loading, setLoading] = useState(false);
	const [pending, setPending] = useState(false);
	const accessToken = useUserDetails((state) => state?.accessToken);
	const currentTime = new Date();
	useEffect(() => {
		if (!socket.connected) {
			console.log("🔌 Connecting to socket server...");
			socket.connect();
		}
	}, []);

	const { destination, location, rider, numberOfPassenger } = useRideStore(
		(state) => ({
			destination: state.destination,
			location: state.location,
			rider: state.rider,
			numberOfPassenger: state.numberOfPassenger,
		})
	);
	const ToPromo = () => {
		navigation.navigate("Promo");
	};

	const BookRide = async () => {
		setLoading(true);

		const request = {
			destination,
			rider_name: rider,
			number_of_passengers: numberOfPassenger,
			start_time: currentTime.toLocaleString(),
			location,
			amount: (numberOfPassenger * 200).toString(),
		};

		const header = {
			headers: { Authorization: `Bearer ${accessToken}` },
		};

		try {
			const response = await axios.post(API.CreateRide, request, header);
			console.log("✅ Ride created:", response?.data?.data);

			const rideId = response.data?.data?.id;
			const UserId = response.data?.data?.user_id; // Assuming user_id is returned in the response

			const emitRide = () => {
				console.log("📤 Emitting join and ride_booked...");
				console.log("Ride ID:", rideId);
				console.log("userId:", UserId);
				socket.emit("join", {
					role: "customer",
					userId: UserId, // Replace with user ID if available
				});
				socket.emit("book_ride", {
					rideId,
					rider,
					location,
					destination,
					numberOfPassengers: numberOfPassenger,
					amount: numberOfPassenger * 200,
				});
			};

			console.log("🔌 Is socket connected?", socket.connected);
			if (socket.connected) {
				console.log("🔥 Socket already connected. Emitting ride...");
				emitRide();
			} else {
				console.log("⏳ Waiting for socket to connect...");
				socket.once("connect", () => {
					console.log("✅ user Connected to socket server:", socket.id);
					emitRide();
				});
			}

			socket.on("connect_error", (err) => {
				// console.log("❌ user Connection error:", err.message);
			});

			setLoading(false);
			setPending(true);
		} catch (e) {
			console.log("❌ Error creating ride:", e?.response?.data);
			setLoading(false);
		}
	};

	useEffect(() => {
		socket.on("ride_accepted", ({ rideId, driverId }) => {
			console.log("✅ Your ride has been accepted by driver:", driverId);
			setPending(false);
			createRide(true);

			// You can now navigate or show a success message
		});

		return () => {
			socket.off("ride_accepted");
		};
	}, []);

	return (
		<>
			<BottomSheet
				snapPoints={["40%"]}
				backgroundStyle={{ borderRadius: 30 }}
				handleComponent={null}
			>
				<View style={styles.bottomCont}>
					<View style={styles.callDriver}>
						<Avatar width={50} height={50} />
						<View style={styles.driverDetails}>
							<Text style={styles.driverName}>
								{rider ? rider : "not found"}
							</Text>
							<View style={styles.info}>
								<View style={{ flexDirection: "row", alignItems: "center" }}>
									<Star />
									<Text>4.7</Text>
								</View>
							</View>
						</View>
						<View style={styles.phoneCont}>
							<Phone width={25} height={25} />
						</View>
					</View>
					<View style={styles.locationCont}>
						<Direction width={40} height={80} />
						<View style={styles.places}>
							<View style={styles.location}>
								<Text style={styles.locationText}>
									{location ? location : "not found"}
								</Text>
							</View>
							<View style={styles.location}>
								<Text style={styles.locationText}>
									{destination ? destination : "not found"}
								</Text>
							</View>
						</View>
					</View>
					<View style={styles.payment}>
						<Naira />
						<Text style={styles.PaymentText}>Cash/Transfer</Text>
						<Text style={styles.price}># {numberOfPassenger * 200}</Text>
					</View>
					<TouchableOpacity
						onPress={ToPromo}
						activeOpacity={0.6}
						style={styles.promo}
					>
						<Text style={styles.promoText}>Enter promo code</Text>
						<Entypo
							name="chevron-small-right"
							size={24}
							color={colors.primaryBlue}
						/>
					</TouchableOpacity>
					<View style={styles.button}>
						{pending ? (
							<View
								style={{
									alignItems: "center",
									flexDirection: "row",
									justifyContent: "space-between",
								}}
							>
								<DangerButton title={"Cancel"} />
								<ActiveButton title={"Ride Pending..."} disabled={true}/>
							</View>
						) : (
							<ActiveButton
								title={"Confirm Rider"}
								onPress={BookRide}
								loading={loading}
							/>
						)}
					</View>
				</View>
			</BottomSheet>
			{selectRider && <RideConfirm modal={selectRider} setModal={createRide} driverName={rider}/>}
		</>
	);
};

export default ConfirmRide;

const styles = StyleSheet.create({
	bottomCont: {
		flex: 1,
		paddingBottom: 16,
	},
	callDriver: {
		backgroundColor: colors.lightGrey,
		paddingVertical: 10,
		justifyContent: "space-between",
		width: "100%",
		borderTopLeftRadius: 30,
		borderTopRightRadius: 30,
		paddingHorizontal: 16,
		flexDirection: "row",
	},
	button: {
		marginTop: "auto",
		paddingHorizontal: 16,
	},
	driverDetails: {
		marginHorizontal: 16,
		flex: 1,
	},
	driverName: {
		fontFamily: "Albert-SemiBold",
		fontSize: 16,
	},
	info: {
		flexDirection: "row",
		alignItems: "center",
		marginTop: 8,
		gap: 12,
	},
	price: {
		fontSize: 16,
		fontFamily: "Albert-SemiBold",
	},
	phoneCont: {
		justifyContent: "center",
		alignItems: "center",
		width: 50,
		height: 50,
		borderRadius: 25,
		backgroundColor: "white",
	},
	locationCont: {
		alignItems: "center",
		flexDirection: "row",
		paddingHorizontal: 16,
		borderBottomWidth: 0.6,
		borderColor: colors.lightGrey3,
	},
	places: {
		justifyContent: "center",
		marginLeft: 16,
		flex: 1,
	},
	location: {
		width: "100%",
		paddingVertical: 10,
		backgroundColor: "white",
		borderBottomWidth: 0.6,
		borderColor: colors.lightGrey3,
	},
	locationText: {
		fontFamily: "Albert-Regular",
		fontSize: 16,
	},
	payment: {
		justifyContent: "space-between",
		width: "100%",
		borderTopLeftRadius: 30,
		borderTopRightRadius: 30,
		paddingHorizontal: 16,
		flexDirection: "row",
		alignItems: "center",
	},
	PaymentText: {
		fontFamily: "Albert-Regular",
		fontSize: 16,
		marginLeft: 10,
		marginRight: "auto",
	},
	promo: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		width: "100%",
		justifyContent: "flex-end",
		gap: 5,
		marginVertical: 16,
	},
	promoText: {
		fontFamily: "Albert-SemiBold",
		fontSize: 16,
		color: colors.primaryBlue,
	},
});
