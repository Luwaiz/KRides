import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { PayWithFlutterwave } from "flutterwave-react-native";
import React from "react";

const Payment = ({ email, amount, name, phoneNumber, BookRide }) => {
	console.log("💳 Payment component rendered with:");
	console.log("   - Email:", email || "MISSING");
	console.log("   - Amount:", amount);
	console.log("   - Name:", name || "MISSING");
	console.log("   - Phone:", phoneNumber || "MISSING");

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
		console.log("💳 Payment redirect data:", data);
		console.log("💳 Payment status:", data?.status);

		if (data.status === "completed" || data.status === "successful") {
			// Handle successful payment
			console.log("✅ Payment successful! Creating ride...");
			BookRide();
		} else {
			console.log("❌ Payment was not completed. Status:", data.status);
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
		console.log("🔘 CustomButton rendered - onPress available:", !!onPress);

		return (
			<TouchableOpacity
				style={[styles.payButton, disabled && styles.payButtonDisabled]}
				onPress={() => {
					console.log("🎯 Payment button pressed!");
					if (onPress) {
						console.log("✅ Calling Flutterwave onPress handler");
						onPress();
					} else {
						console.log("❌ No onPress handler available");
					}
				}}
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
				onAbort={() => console.log("❌ Payment aborted")}
				onWillInitialize={() => console.log("🚀 Payment initializing...")}
				onDidInitialize={() => console.log("✅ Payment initialized")}
				options={{
					tx_ref: generateTransactionRef(10),
					authorization: "FLWPUBK_TEST-1c7224ec1e2677cd1261b0fa3bbc0453-X",
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
