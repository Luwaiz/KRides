import {
	ActivityIndicator,
	FlatList,
	StyleSheet,
	Text,
	View,
} from "react-native";
import BottomSheet, { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import React, { useEffect, useState } from "react";
import ActiveButton from "../buttons/ActiveButton";
import { colors } from "../../constants/styling";
import { useBottomTabStore, useDriverDetails } from "../../constants/Store";
import Avatar from "../../assets/svg/Frame 77avatar.svg";
import DangerButton from "../buttons/DangerButton";
import Destination from "../Destination";
import axios from "axios";
import API from "../../hooks/API";
import socket from "../../hooks/Socket";

const HomeTab = () => {
	const accessToken = useDriverDetails((state) => state.accessToken);
	const VehicleId = useDriverDetails((state) => state.vehicle_id);
	const [loading, setLoading] = useState(false);
	const [accepting, setAccepting] = useState(null);
	const [rides, setRides] = useState([]);

	//call all pening rides
	const RidesPending = async () => {
		setLoading(true);
		const header = {
			headers: { Authorization: `Bearer ${accessToken}` },
		};
		try {
			const response = await axios.get(API.PendingRides, header);
			setRides("pending", response?.data?.data);
			setLoading(false);
		} catch (e) {
			console.log("ressss", e.response.data.message);
			if (e.response.data.message === "No pending trips found for this user.") {
				setRides([]);
			}
			setLoading(false);
		}
	};

	const AcceptRide = async (rideId) => {
		console.log("this is the ride id ", rideId);
		setAccepting(rideId);
		const header = {
			headers: { Authorization: `Bearer ${accessToken}` },
		};
		try {
			const response = await axios.post(
				`${API.AcceptRide}/${rideId}/accept`,
				{},
				header
			);
			console.log("api respone", response?.data?.trip);
			console.log("Ride accepted successfully");
			const customerId = response.data?.trip?.user_id;
			console.log("Customer ID:", customerId);
			const driverId = VehicleId;
			// Notify customer via socket
			if (socket.connected) {
				socket.emit("accept_ride", {
					rideId,
					driverId,
					customerId,
				});
				console.log("✅ Emit: accept_ride sent to server");
			} else {
				console.warn("❌ Socket not connected. Could not emit accept_ride.");
			}

			setRides((prevRides) => prevRides.filter((ride) => ride.id !== rideId));
			setAccepting(null);
		} catch (e) {
			console.error("Error accepting ride:", e.response.data.message);
			setAccepting(null);
		}
	};

	useEffect(() => {
		RidesPending();
	}, []);

	useEffect(() => {
		socket.connect(); // Connect once when component mounts
		console.log("🔌 Connecting to socket server...", VehicleId);
		const handleConnect = () => {
			console.log("✅ Connected to socket server:", socket.id);
			socket.emit("join", {
				role: "driver",
				userId: VehicleId,
			});
		};

		socket.on("connect", handleConnect);

		socket.on("ride_booked", (newRide) => {
			console.log("Ride received via socket", newRide);
			console.log("📨 Received new ride from socket:", newRide);
			setRides((prevRides) => [newRide, ...prevRides]);
		});

		socket.on("connect_error", (err) => {
			console.log("❌ Connection error:", err.message);
		});

		return () => {
			socket.off("connect", handleConnect);
			socket.off("ride_booked");
			socket.off("connect_error");
		};
	}, []);

	return (
		<BottomSheet
			snapPoints={rides.length > 1 ? ["76%"] : ["50%"]}
			backgroundStyle={{ borderRadius: 30 }}
			handleComponent={null}
		>
			{loading ? (
				<ActivityIndicator />
			) : (
				<View style={styles.sheetCont}>
					<View style={styles.topText}>
						<Text style={styles.where}>Ride request</Text>
					</View>
					{rides?.length === 0 ? (
						<Text style={styles.noRides}>No pending rides</Text>
					) : (
						<BottomSheetFlatList
							data={rides}
							keyExtractor={(item) =>
								item?.rideId?.toString() ?? Math.random().toString()
							}
							renderItem={({ item }) => (
								<View style={styles.container}>
									<View style={styles.details}>
										<Avatar width={50} height={50} />
										<View>
											<Text style={styles.name}>{item?.name}</Text>
											<Text style={styles.time}>
												Passengers: {item?.number_of_passengers}
											</Text>
											<Text style={styles.time}>N{item?.amount}</Text>
										</View>
									</View>
									<Destination
										location={item?.location}
										destination={item?.destination}
									/>
									<View style={styles.button}>
										<DangerButton title={"Decline"} />
										<ActiveButton
											title={"Accept"}
											onPress={() => AcceptRide(item?.rideId || item?.id)}
											loading={accepting === item?.id}
										/>
									</View>
								</View>
							)}
						/>
					)}
				</View>
			)}
		</BottomSheet>
	);
};

export default HomeTab;

const styles = StyleSheet.create({
	sheetCont: {
		flex: 1,
		paddingBottom: 16,
		paddingTop: 30,
		paddingHorizontal: 16,
	},
	container: {
		marginBottom: 30,
	},
	topText: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 16,
	},
	time: {
		color: colors.lightGrey3,
		fontSize: 14,
	},
	details: {
		alignItems: "center",
		marginBottom: 16,
		flexDirection: "row",
		gap: 10,
	},
	where: {
		fontSize: 24,
		fontWeight: "bold",
		color: "black",
	},
	name: {
		fontFamily: "Albert-SemiBold",
		fontSize: 16,
	},
	button: {
		marginTop: 20,
		flexDirection: "row",
		justifyContent: "space-between",
	},
	noRides: {
		fontSize: 16,
		color: colors.lightGrey3,
		textAlign: "center",
		marginTop: 20,
	},
});
