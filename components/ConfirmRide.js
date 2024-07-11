import { Dimensions, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import BottomSheet from "@gorhom/bottom-sheet";
import React, { useState } from "react";
import ActiveButton from "./buttons/ActiveButton";
import { colors } from "../constants/styling";
import { useNavigation } from "@react-navigation/native";
import { Entypo } from '@expo/vector-icons';
import Avatar from "../assets/svg/Frame 77avatar.svg";
import Phone from "../assets/svg/Call.svg";
import Star from "../assets/svg/Rating.svg";
import Direction from "../assets/svg/Frame 34direction.svg";
import Naira from "../assets/svg/Naira.svg";
import RideConfirm from "./modals/RideConfirm";

const ConfirmRide = ({}) => {
	const navigation = useNavigation();
    const [selectRider, setSelectRider] = useState(false);

    const ToPromo=()=>{
        navigation.navigate("Promo")
    }
	const RiderSelected = () => {
		setSelectRider(true)
	};
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
						<Text style={styles.driverName}>Henry</Text>
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
							<Text style={styles.locationText}>Winslow Hall</Text>
						</View>
						<View style={styles.location}>
							<Text style={styles.locationText}>BUSA House</Text>
						</View>
					</View>
				</View>
				<View style={styles.payment}>
					<Naira />
					<Text style={styles.PaymentText}>Cash/Transfer</Text>
					<Text style={styles.price}># 200</Text>
				</View>
				<TouchableOpacity onPress={ToPromo} activeOpacity={0.6} style={styles.promo}>
					<Text style={styles.promoText}>Enter promo code</Text>
					<Entypo name="chevron-small-right" size={24} color={colors.primaryBlue} />
				</TouchableOpacity>
				<View style={styles.button}>
					<ActiveButton title={"Confirm Rider"} onPress={RiderSelected} />
				</View>
			</View>
		</BottomSheet>
        {selectRider && <RideConfirm modal={selectRider} setModal={setSelectRider}/>}
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
    promo:{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        width: "100%",
        justifyContent:"flex-end",
        gap :5,
        marginVertical:16
    },
    promoText:{
        fontFamily: "Albert-SemiBold",
        fontSize: 16,
        color: colors.primaryBlue,
    }
});
