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
		for (let i = 0; i < length; i++) {
			result += chars.charAt(Math.floor(Math.random() * chars.length));
		}
	}
	return `flw_tx_ref_${result}_${Date.now()}`;
};

const Payment = ({ email, amount, name, phoneNumber, BookRide, loading = false }) => {
	const [txRef, setTxRef] = useState(() => generateTransactionRef(10));

	if (!amount || amount <= 0) {
		console.error("❌ Invalid amount for payment:", amount);
		return (
			<View style={styles.container}>
				<Text style={styles.errorText}>Unable to process payment: Invalid amount</Text>
			</View>
		);
	}

	const handleOnRedirect = (data) => {
		setTimeout(() => {
			if (data.status === "completed" || data.status === "successful") {
				const transactionId = data.transaction_id || data.flw_ref || data.tx_ref;
				if (!transactionId) {
					setTxRef(generateTransactionRef(10));
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
				setTxRef(generateTransactionRef(10));
				Toast.show({
					type: 'tomatoToast',
					text1: 'Payment Cancelled',
					text2: "You cancelled the payment. Tap 'Pay' below to try again.",
					position: 'top',
					visibilityTime: 4000,
				});
			} else {
				setTxRef(generateTransactionRef(10));
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
		setTimeout(() => {
			setTxRef(generateTransactionRef(10));
			Toast.show({
				type: 'tomatoToast',
				text1: 'Payment Cancelled',
				text2: "You cancelled the payment. Tap 'Pay' below to try again.",
				position: 'top',
				visibilityTime: 4000,
			});
		}, 1500);
	};

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
