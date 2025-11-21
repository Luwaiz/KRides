import React, { useState } from "react";
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    Alert,
    ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../constants/styling";
import TextInput1 from "../../components/TextInput1";
import ActiveButton from "../../components/buttons/ActiveButton";
import BackButton from "../../components/buttons/BackButton";
import { Picker } from "@react-native-picker/picker";
import { httpsCallable } from "firebase/functions";
import { FIREBASE_FUNCTIONS, FIREBASE_DB, FIREBASE_AUTH } from "../../firebaseConfig";
import { doc, updateDoc } from "firebase/firestore";
import { useDriverDetails } from "../../constants/Store";

const NIGERIAN_BANKS = [
    { label: "Access Bank", value: "044" },
    { label: "Guaranty Trust Bank", value: "058" },
    { label: "United Bank for Africa", value: "033" },
    { label: "Zenith Bank", value: "057" },
    { label: "First Bank of Nigeria", value: "011" },
    { label: "Fidelity Bank", value: "070" },
    { label: "First City Monument Bank", value: "214" },
    { label: "Union Bank of Nigeria", value: "032" },
    { label: "Sterling Bank", value: "232" },
    { label: "Stanbic IBTC Bank", value: "221" },
    { label: "Polaris Bank", value: "076" },
    { label: "Wema Bank", value: "035" },
    { label: "Ecobank Nigeria", value: "050" },
    { label: "Heritage Bank", value: "030" },
    { label: "Keystone Bank", value: "082" },
    { label: "Jaiz Bank", value: "301" },
    { label: "Titan Trust Bank", value: "102" },
    { label: "SunTrust Bank", value: "100" },
    { label: "Providus Bank", value: "101" },
    { label: "Kuda Bank", value: "50211" },
    { label: "Moniepoint Microfinance Bank", value: "50515" },
    { label: "Opay", value: "999992" },
    { label: "Palmpay", value: "999991" },
];

const BankAccountDetails = ({ navigation, route }) => {
    const [bankCode, setBankCode] = useState(NIGERIAN_BANKS[0].value);
    const [accountNumber, setAccountNumber] = useState("");
    const [accountName, setAccountName] = useState("");
    const [loading, setLoading] = useState(false);

    // Get driver details from store or route params
    const { fullName, phone, uid } = useDriverDetails((state) => ({
        fullName: state.fullName,
        phone: state.phone,
        uid: state.uid || FIREBASE_AUTH.currentUser?.uid,
    }));

    const handleSubmit = async () => {
        if (!accountNumber || accountNumber.length < 10) {
            Alert.alert("Invalid Input", "Please enter a valid account number.");
            return;
        }
        if (!accountName) {
            Alert.alert("Invalid Input", "Please enter the account name.");
            return;
        }

        setLoading(true);

        try {
            const selectedBank = NIGERIAN_BANKS.find((b) => b.value === bankCode);
            const bankName = selectedBank ? selectedBank.label : "Unknown Bank";
            const driverId = uid || FIREBASE_AUTH.currentUser?.uid;

            if (!driverId) {
                throw new Error("Driver ID not found. Please login again.");
            }

            console.log("Creating subaccount for driver:", driverId);

            // 1. Call Firebase Function to create subaccount
            const createSubAccountFn = httpsCallable(
                FIREBASE_FUNCTIONS,
                "createDriverSubAccount"
            );

            const response = await createSubAccountFn({
                driverId,
                accountBank: bankCode,
                accountNumber,
                businessName: fullName || accountName, // Fallback to account name if full name missing
                businessEmail: `${phone}@rideapp.com`, // Generated email
                businessMobile: phone,
                splitValue: 50, // Company fee
            });

            const result = response.data;
            console.log("Subaccount creation result:", result);

            if (result.status === "success" || result.status === "ok") {
                // 2. Update Firestore locally (redundant if function does it, but good for UI update)
                // The function should handle the Firestore update for security, but we can update local state if needed.
                // We'll assume the function updated the 'drivers' collection.

                Alert.alert(
                    "Success",
                    "Bank account details saved successfully!",
                    [
                        {
                            text: "Continue",
                            onPress: () => {
                                navigation.replace("DriverStack", {
                                    params: {
                                        params: "DriverHome",
                                    },
                                });
                            },
                        },
                    ]
                );
            } else {
                throw new Error(result.message || "Failed to create subaccount");
            }
        } catch (error) {
            console.error("Error saving bank details:", error);
            Alert.alert(
                "Error",
                error.message || "Could not save bank details. Please try again."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={{ flex: 1 }}>
                <View style={styles.topCont}>
                    <BackButton text={<Text style={styles.headText}>Bank Details</Text>} />
                </View>
                <View style={styles.bottomCont}>
                    <View style={styles.sheetCont}>
                        <Text style={styles.subText}>
                            Please provide your bank account details to receive payments.
                        </Text>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Select Bank</Text>
                            <View style={styles.pickerContainer}>
                                <Picker
                                    selectedValue={bankCode}
                                    onValueChange={(itemValue) => setBankCode(itemValue)}
                                    style={styles.picker}
                                >
                                    {NIGERIAN_BANKS.map((bank) => (
                                        <Picker.Item
                                            key={bank.value}
                                            label={bank.label}
                                            value={bank.value}
                                        />
                                    ))}
                                </Picker>
                            </View>
                        </View>

                        <TextInput1
                            text={"Account Number"}
                            placeholder={"0123456789"}
                            keyboardType="numeric"
                            maxLength={10}
                            onChangeText={setAccountNumber}
                            value={accountNumber}
                        />

                        <TextInput1
                            text={"Account Name"}
                            placeholder={"John Doe"}
                            onChangeText={setAccountName}
                            value={accountName}
                        />

                        <View style={{ marginTop: 30 }}>
                            <ActiveButton
                                title={loading ? "Processing..." : "Save & Continue"}
                                onPress={handleSubmit}
                                disabled={loading}
                                loading={loading}
                            />
                        </View>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default BankAccountDetails;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.primaryBlue,
    },
    topCont: {
        flex: 1,
        backgroundColor: colors.primaryBlue,
        paddingTop: 26,
    },
    headText: {
        color: colors.secondary,
        fontSize: 24,
        fontFamily: "Albert-SemiBold",
    },
    bottomCont: {
        backgroundColor: colors.secondary,
        width: "100%",
        marginTop: 20,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        minHeight: 600,
    },
    sheetCont: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 30,
    },
    subText: {
        fontFamily: "Albert-Regular",
        fontSize: 14,
        color: "#666",
        marginBottom: 20,
        textAlign: "center",
    },
    inputContainer: {
        marginBottom: 15,
        width: "100%",
    },
    label: {
        fontFamily: "Albert-Medium",
        fontSize: 14,
        marginBottom: 8,
        color: "#333",
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: "#E0E0E0",
        borderRadius: 12,
        backgroundColor: "#F9F9F9",
        overflow: "hidden",
    },
    picker: {
        height: 50,
        width: "100%",
    },
});
