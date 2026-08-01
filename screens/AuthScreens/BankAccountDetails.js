import React, { useState } from "react";
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    Alert,
    ActivityIndicator,
    TouchableOpacity,
    Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../constants/styling";
import TextInput1 from "../../components/TextInput1";
import ActiveButton from "../../components/buttons/ActiveButton";
import BackButton from "../../components/buttons/BackButton";
import { Picker } from "@react-native-picker/picker";
import { FIREBASE_DB, FIREBASE_AUTH } from "../../firebaseConfig";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
const PAYMENTS_SERVER_URL = 'https://krides.onrender.com/api/payments';
import { NOTIFICATION_API_KEY } from "@env";
import { useDriverDetails } from "../../constants/Store";
const { width, height } = Dimensions.get("window");
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
        if (!accountNumber || !/^\d{10}$/.test(accountNumber)) {
            Alert.alert("Invalid Account Number", "Nigerian bank account numbers must be exactly 10 digits.");
            return;
        }
        if (!accountName || accountName.trim().length < 2) {
            Alert.alert("Invalid Account Name", "Please enter the account name as it appears on your bank account.");
            return;
        }

        setLoading(true);

        try {
            const selectedBank = NIGERIAN_BANKS.find((b) => b.value === bankCode);
            const bankName = selectedBank ? selectedBank.label : "Unknown Bank";
            const currentUser = FIREBASE_AUTH.currentUser;
            const driverId = uid || currentUser?.uid;

            if (!driverId || !currentUser) {
                throw new Error("Driver ID not found. Please login again.");
            }

            const idToken = await currentUser.getIdToken();

            // Call our backend — secret key stays server-side
            const response = await fetch(`${PAYMENTS_SERVER_URL}/create-subaccount`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": NOTIFICATION_API_KEY || "",
                    "Authorization": `Bearer ${idToken}`,
                },
                body: JSON.stringify({
                    bankCode,
                    accountNumber,
                    accountName,
                    businessName: fullName || accountName,
                    phone,
                }),
            });

            const result = await response.json();
            console.log("Subaccount creation result:", result);

            if (result.success) {
                const subaccountId = result.data.subaccount_id;
                const verifiedBankName = result.data.bank_name || bankName;
                // Server resolves the account number against the bank before
                // creating the subaccount — use that verified name rather than
                // the driver's app profile name, which is often different from
                // the name on their bank account.
                const verifiedAccountName = result.data.verified_account_name || accountName;

                // 2. Update Firestore locally
                const driverRef = doc(FIREBASE_DB, "drivers", driverId);
                await updateDoc(driverRef, {
                    bankName: verifiedBankName,
                    bankCode: bankCode,
                    accountNumber: accountNumber,
                    accountName: verifiedAccountName,
                    subaccountId: subaccountId,
                    subaccountCreatedAt: serverTimestamp(),
                    bankDetailsVerified: true,
                });

                // Update local store to trigger navigation switch
                useDriverDetails.getState().setDriverProfile({
                    ...useDriverDetails.getState(),
                    bankName: verifiedBankName,
                    bankCode: bankCode,
                    accountNumber: accountNumber,
                    accountName: verifiedAccountName,
                    bankDetailsVerified: true,
                });

                Alert.alert(
                    "Success",
                    "Bank account details saved successfully!",
                    [
                        {
                            text: "Continue",
                            onPress: () => {
                                navigation.replace("DriverHome");
                            },
                        },
                    ]
                );
            } else {
                Alert.alert("Error", result.error || "Could not save bank details. Please check your account details and try again.");
            }
        } catch (error) {
            console.error("Error saving bank details:", error);
            Alert.alert("Error", error.message || "Could not save bank details.");
        } finally {
            setLoading(false);
        }
    };

    const handleSkip = async () => {
        Alert.alert(
            "Skip Bank Details",
            "Are you sure you want to skip? You won't be able to receive payments until you add your bank details.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Skip",
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const driverId = uid || FIREBASE_AUTH.currentUser?.uid;
                            if (!driverId) return;

                            const driverRef = doc(FIREBASE_DB, "drivers", driverId);
                            await updateDoc(driverRef, { bankDetailsSkipped: true });

                            useDriverDetails.getState().setDriverProfile({
                                ...useDriverDetails.getState(),
                                bankDetailsSkipped: true,
                            });

                            navigation.replace("DriverHome");
                        } catch (error) {
                            console.error("Error skipping:", error);
                            Alert.alert("Error", "Could not skip. Please try again.");
                        } finally {
                            setLoading(false);
                        }
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={{ flex: 1 }}>
                <View style={styles.topCont}>
                    <View style={styles.headerRow}>
                        <BackButton text={<Text style={styles.headText}>Bank Details</Text>} />
                        <TouchableOpacity onPress={handleSkip} disabled={loading}>
                            <Text style={styles.skipText}>{loading ? "..." : "Skip"}</Text>
                        </TouchableOpacity>
                    </View>
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
                            onChangeText={(text) => setAccountNumber(text.replace(/\D/g, ""))}
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
        paddingTop: 20,
    },
    headText: {
        color: colors.secondary,
        fontSize: 24,
        fontFamily: "Albert-SemiBold",
    },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingRight: 50,
    },
    skipText: {
        color: colors.secondary,
        fontSize: 16,
        fontFamily: "Albert-Medium",
        paddingTop: 10,
    },
    bottomCont: {
        backgroundColor: colors.secondary,
        width: width,
        marginTop: 20,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        height: height - 100,
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
