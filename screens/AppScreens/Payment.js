import { StyleSheet, Text, View, TouchableOpacity, Alert } from "react-native";
import { PayWithFlutterwave } from "flutterwave-react-native";
import React, { useState } from "react";
import { FLUTTERWAVE_PUBLIC_KEY } from "@env";

const generateTransactionRef = (length) => {
	var result = "";
	var characters =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	for (var i = 0; i < length; i++) {
		result += characters.charAt(
			Math.floor(Math.random() * characters.length)
		);
	}
	return `flw_tx_ref_${result}`;
};

const Payment = ({ email, amount, name, phoneNumber, BookRide, loading = false }) => {
	// txRef as state so it can be refreshed on cancel/failure, letting the user
	// retry payment.  PayWithFlutterwaveBase checks reference===options.tx_ref to
	// detect a duplicate attempt — a new value clears that check for the next tap.
	// We only ever call setTxRef inside the 750ms setTimeout (below), so the
	// resulting re-render is well past the Flutterwave dismiss animation window.
	const [txRef, setTxRef] = useState(() => generateTransactionRef(10));

	// Safety check for required data
	if (!amount || amount <= 0) {
		console.error("❌ Invalid amount for payment:", amount);
		return (
			<View style={styles.container}>
				<Text style={styles.errorText}>Unable to process payment: Invalid amount</Text>
			</View>
		);
	}

	const handleOnRedirect = (data) => {
		// Flutterwave calls onRedirect AFTER its own 400ms animateOut() completes,
		// then sets Modal visible=false — the UIKit dismiss transition starts at that
		// point and takes ~350ms.  Any Alert.alert() or BookRide() call that reaches
		// the native layer during that window triggers the iOS 26 SIGABRT
		// "_presentViewController inside _runAlongsideCompletions" crash.
		// Delaying by 750ms guarantees we are past the 400ms + 350ms window.
		setTimeout(() => {
			if (data.status === "completed" || data.status === "successful") {
				const transactionId = data.transaction_id || data.flw_ref || data.tx_ref;
				if (!transactionId) {
					setTxRef(generateTransactionRef(10)); // allow retry
					Alert.alert(
						"Payment Reference Missing",
						"Your payment went through but we couldn't get a reference number. Please contact support and we'll sort it out.",
						[{ text: "OK" }]
					);
					return;
				}
				BookRide(transactionId);
			} else if (data.status === "cancelled") {
				setTxRef(generateTransactionRef(10)); // allow retry
				Alert.alert(
					"Payment Cancelled",
					"You cancelled the payment. Tap 'Pay' below to try again.",
					[{ text: "OK" }]
				);
			} else {
				setTxRef(generateTransactionRef(10)); // allow retry
				Alert.alert(
					"Payment Failed",
					"Your payment could not be completed. Please try again or use a different payment method.",
					[{ text: "Try Again" }]
				);
			}
		}, 750);
	};

	const handleOnAbort = () => {
		// Same timing fix — Flutterwave calls onAbort after animateOut(), so the
		// UIKit dismiss is still in progress when this fires.
		setTimeout(() => {
			setTxRef(generateTransactionRef(10)); // allow retry
			Alert.alert(
				"Payment Cancelled",
				"You cancelled the payment. Tap 'Pay' below to try again.",
				[{ text: "OK" }]
			);
		}, 500);
	};

	// Custom button component that receives onPress from Flutterwave
	const CustomButton = ({ onPress, disabled, isInitializing }) => {
		const isDisabled = disabled || isInitializing || loading;
		return (
			<TouchableOpacity
				style={[styles.payButton, isDisabled && styles.payButtonDisabled]}
				onPress={onPress}
				disabled={isDisabled}
			>
				<Text style={styles.payButtonText}>
					{loading
						? "Booking ride..."
						: isInitializing
						? "Initializing..."
						: disabled
						? "Processing..."
						: `Pay ₦${amount}`}
				</Text>
			</TouchableOpacity>
		);
	};

	return (
		<View style={styles.container}>
			<PayWithFlutterwave
				onRedirect={handleOnRedirect}
				onAbort={handleOnAbort}
				onWillInitialize={() => {}}
				onDidInitialize={() => {}}
				options={{
					tx_ref: txRef,
					authorization: FLUTTERWAVE_PUBLIC_KEY,
					customer: {
						email: email || "customer@kampusride.com",
						name: name || "Customer",
						phonenumber: phoneNumber || "08000000000",
					},
					amount: amount,
					currency: "NGN",
					payment_options: "card,banktransfer,ussd",
				}}
				customButton={CustomButton}
			/>
		</View>
	);
};

export default Payment;

const styles = StyleSheet.create({
	container: {
		width: "100%",
	},
	payButton: {
		backgroundColor: "#007AFF",
		paddingVertical: 16,
		paddingHorizontal: 20,
		borderRadius: 12,
		alignItems: "center",
		justifyContent: "center",
		width: "100%",
	},
	payButtonDisabled: {
		backgroundColor: "#ccc",
	},
	payButtonText: {
		color: "#FFFFFF",
		fontSize: 18,
		fontWeight: "bold",
	},
	errorText: {
		color: "#FF3B30",
		fontSize: 14,
		textAlign: "center",
		padding: 16,
	},
});
