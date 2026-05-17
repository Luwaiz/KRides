import { StyleSheet, Text, View, TouchableOpacity, Alert } from "react-native";
import { PayWithFlutterwave } from "flutterwave-react-native";
import React, { useState } from "react";
import { FLUTTERWAVE_PUBLIC_KEY } from "@env";
import Toast from "react-native-toast-message";

const generateTransactionRef = (length = 12) => {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	let result = "";
	try {
		const bytes = new Uint8Array(length);
		crypto.getRandomValues(bytes);
		result = Array.from(bytes).map(b => chars[b % chars.length]).join("");
	} catch {
		// Fallback for environments where crypto is unavailable
		for (let i = 0; i < length; i++) {
			result += chars.charAt(Math.floor(Math.random() * chars.length));
		}
	}
	// Append timestamp to guarantee uniqueness even if randomness collides
	return `flw_tx_ref_${result}_${Date.now()}`;
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
		// Increased to 1500ms to be absolutely safe on newer/slower devices.
		setTimeout(() => {
			if (data.status === "completed" || data.status === "successful") {
				const transactionId = data.transaction_id || data.flw_ref || data.tx_ref;
				if (!transactionId) {
					setTxRef(generateTransactionRef(10)); // allow retry
					Toast.show({
						type: 'tomatoToast',
						text1: 'Payment Reference Missing',
						text2: "Your payment went through but we couldn't get a reference number. Please contact support.",
						position: 'top',
						visibilityTime: 6000,
					});
					return;
				}
				BookRide(transactionId);
			} else if (data.status === "cancelled") {
				setTxRef(generateTransactionRef(10)); // allow retry
				Toast.show({
					type: 'tomatoToast',
					text1: 'Payment Cancelled',
					text2: "You cancelled the payment. Tap 'Pay' below to try again.",
					position: 'top',
					visibilityTime: 4000,
				});
			} else {
				setTxRef(generateTransactionRef(10)); // allow retry
				Toast.show({
					type: 'tomatoToast',
					text1: 'Payment Failed',
					text2: "Your payment could not be completed. Please try again or use a different method.",
					position: 'top',
					visibilityTime: 5000,
				});
			}
		}, 1500);
	};

	const handleOnAbort = () => {
		// Same timing fix — Flutterwave calls onAbort after animateOut(), so the
		// UIKit dismiss is still in progress when this fires.
		setTimeout(() => {
			setTxRef(generateTransactionRef(10)); // allow retry
			Toast.show({
				type: 'tomatoToast',
				text1: 'Payment Cancelled',
				text2: "You cancelled the payment. Tap 'Pay' below to try again.",
				position: 'top',
				visibilityTime: 4000,
			});
		}, 1500);
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
