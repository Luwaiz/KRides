import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { PayWithFlutterwave } from "flutterwave-react-native";
import React from "react";
import { FLUTTERWAVE_PUBLIC_KEY } from "@env";

const Payment = ({ email, amount, name, phoneNumber, BookRide }) => {
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
		if (data.status === "completed" || data.status === "successful") {
			const transactionId = data.transaction_id || data.flw_ref || data.tx_ref || null;
			BookRide(transactionId);
		}
	};

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

	// Custom button component that receives onPress from Flutterwave
	const CustomButton = ({ onPress, disabled, isInitializing }) => {
		return (
			<TouchableOpacity
				style={[styles.payButton, disabled && styles.payButtonDisabled]}
				onPress={onPress}
				disabled={disabled || isInitializing}
			>
				<Text style={styles.payButtonText}>
					{isInitializing
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
				onAbort={() => {}}
				onWillInitialize={() => {}}
				onDidInitialize={() => {}}
				options={{
					tx_ref: generateTransactionRef(10),
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
