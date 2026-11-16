import React, { useEffect, useState } from "react";
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    Alert,
    ActivityIndicator,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../constants/styling";
import { maxContentWidth } from "../../constants/responsive";
import DismissKeyboardView from "../../components/DismissKeyboardView";
import TextInput1 from "../../components/TextInput1";
import ActiveButton from "../../components/buttons/ActiveButton";
import BackButton from "../../components/buttons/BackButton";
import { Picker } from "@react-native-picker/picker";
import { FIREBASE_DB, FIREBASE_AUTH } from "../../firebaseConfig";
import { doc, updateDoc } from "firebase/firestore";
import { NOTIFICATION_API_KEY } from "@env";
import { useDriverDetails } from "../../constants/Store";
import { API_BASE_URL } from "../../constants/server";

const PAYMENTS_SERVER_URL = `${API_BASE_URL}/payments`;
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
    const isEditing = !!route?.params?.isEditing;

    const { fullName, phone, uid, existingBankCode, existingAccountNumber, existingAccountName } = useDriverDetails((state) => ({
        fullName: state.fullName,
        phone: state.phone,
        uid: state.uid || FIREBASE_AUTH.currentUser?.uid,
        existingBankCode: state.bankCode,
        existingAccountNumber: state.accountNumber,
        existingAccountName: state.accountName,
    }));

    const [bankCode, setBankCode] = useState(
        (isEditing && existingBankCode) || NIGERIAN_BANKS[0].value
    );
    const [accountNumber, setAccountNumber] = useState(isEditing ? existingAccountNumber || "" : "");
    const [accountName, setAccountName] = useState(isEditing ? existingAccountName || "" : "");
    const [loading, setLoading] = useState(false);

    // The account name is looked up from the bank as soon as a full number is entered.
    // resolvedFor is the bank + number the shown name belongs to.
    const [resolvedFor, setResolvedFor] = useState(
        isEditing && existingBankCode && existingAccountNumber && existingAccountName
            ? `${existingBankCode}:${existingAccountNumber}`
            : null
    );
    const [resolving, setResolving] = useState(false);
    const [resolveError, setResolveError] = useState(null);
    const [retryCount, setRetryCount] = useState(0);
    // Falls back to typing the name if the server doesn't offer the lookup yet.
    const [manualName, setManualName] = useState(false);

    useEffect(() => {
        if (manualName) return;
        setResolveError(null);

        const key = `${bankCode}:${accountNumber}`;
        if (key === resolvedFor) return;

        setAccountName("");
        if (!/^\d{10}$/.test(accountNumber)) {
            setResolving(false);
            return;
        }

        let cancelled = false;
        let timedOut = false;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, 30000);
        setResolving(true);

        (async () => {
            try {
                const currentUser = FIREBASE_AUTH.currentUser;
                if (!currentUser) throw new Error("Not signed in");
                const idToken = await currentUser.getIdToken();
                const response = await fetch(`${PAYMENTS_SERVER_URL}/resolve-account`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-api-key": NOTIFICATION_API_KEY || "",
                        "Authorization": `Bearer ${idToken}`,
                    },
                    body: JSON.stringify({ bankCode, accountNumber }),
                    signal: controller.signal,
                });
                const result = await response.json().catch(() => null);
                if (cancelled) return;

                if (response.ok && result?.accountName) {
                    setAccountName(result.accountName);
                    setResolvedFor(key);
                } else if (response.status === 404 && result?.code !== "not_found") {
                    // A server without the lookup yet: let the driver type the name instead.
                    setManualName(true);
                } else {
                    setResolveError(result?.error || "Couldn't check this account. Please try again.");
                }
            } catch (error) {
                if (cancelled) return;
                setResolveError(
                    timedOut
                        ? "The bank is taking too long to respond. Please try again."
                        : "Couldn't check this account. Check your connection and try again."
                );
            } finally {
                clearTimeout(timeoutId);
                if (!cancelled) setResolving(false);
            }
        })();

        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
            controller.abort();
        };
    }, [bankCode, accountNumber, manualName, retryCount]);

    const handleSubmit = async () => {
        if (!accountNumber || !/^\d{10}$/.test(accountNumber)) {
            Alert.alert("Invalid Account Number", "Nigerian bank account numbers must be exactly 10 digits.");
            return;
        }
        if (!manualName && (resolvedFor !== `${bankCode}:${accountNumber}` || !accountName)) {
            Alert.alert(
                "Account Not Verified",
                resolving
                    ? "Still checking your account with the bank — give it a moment."
                    : "We need to confirm the account name with your bank first. Check the number and bank, then try again."
            );
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

            const response = await fetch(`${PAYMENTS_SERVER_URL}/create-subaccount`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": NOTIFICATION_API_KEY || "",
                    "Authorization": `Bearer ${idToken}`,
                },
                body: JSON.stringify({
                    bankCode,
                    bankName,
                    accountNumber,
                    accountName,
                    businessName: fullName || accountName,
                    phone,
                }),
            });

            const result = await response.json();
            console.log("Subaccount creation result:", result);

            // The server saves the bank details and marks them verified once Flutterwave
            // confirms the account; the app only mirrors them into local state.
            if (result.success) {
                const verifiedBankName = result.data.bank_name || bankName;
                const verifiedAccountName = result.data.verified_account_name || accountName;

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
                    isEditing ? "Bank account details updated successfully!" : "Bank account details saved successfully!",
                    [
                        {
                            text: "Continue",
                            onPress: leaveScreen,
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

    // Opened from inside the app (profile, "Set up now"), go back to where the driver came
    // from; replacing would stack a second home screen with its own listeners and popups.
    // Only right after sign-up, when this is the first screen, open home in its place.
    const leaveScreen = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            navigation.replace("DriverHome");
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

                            leaveScreen();
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
        <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
                <DismissKeyboardView>
                    <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
                        <View style={styles.topCont}>
                            <View style={styles.headerRow}>
                                <BackButton text={<Text style={styles.headText}>{isEditing ? "Edit Bank Details" : "Bank Details"}</Text>} />
                                {!isEditing && (
                                    <TouchableOpacity onPress={handleSkip} disabled={loading}>
                                        <Text style={styles.skipText}>{loading ? "..." : "Skip"}</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                        <View style={styles.bottomCont}>
                            <View style={styles.sheetCont}>
                                <Text style={styles.subText}>
                                    {isEditing
                                        ? "Update your bank account details below."
                                        : "Please provide your bank account details to receive payments."}
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

                                {manualName ? (
                                    <TextInput1
                                        text={"Account Name"}
                                        placeholder={"John Doe"}
                                        onChangeText={setAccountName}
                                        value={accountName}
                                    />
                                ) : (
                                    <View style={styles.nameCont}>
                                        <Text style={styles.nameLabel}>Account Name</Text>
                                        <View style={[styles.nameBox, resolveError && styles.nameBoxError]}>
                                            {resolving ? (
                                                <>
                                                    <ActivityIndicator size="small" color={colors.primaryBlue} />
                                                    <Text style={styles.nameHint}>Checking with your bank…</Text>
                                                </>
                                            ) : accountName ? (
                                                <>
                                                    <Ionicons name="checkmark-circle" size={20} color="#2e7d32" />
                                                    <Text style={styles.nameValue} numberOfLines={1}>{accountName}</Text>
                                                </>
                                            ) : (
                                                <Text style={styles.nameHint}>
                                                    {resolveError ? "Not verified" : "Shows up once you enter your account number"}
                                                </Text>
                                            )}
                                        </View>
                                        {resolveError ? (
                                            <Text style={styles.nameError}>
                                                {resolveError}{" "}
                                                <Text style={styles.retryText} onPress={() => setRetryCount((n) => n + 1)}>
                                                    Try again
                                                </Text>
                                            </Text>
                                        ) : null}
                                    </View>
                                )}

                                <View style={{ marginTop: 30 }}>
                                    <ActiveButton
                                        title={loading ? "Processing..." : (isEditing ? "Save Changes" : "Save & Continue")}
                                        onPress={handleSubmit}
                                        disabled={loading || resolving}
                                        loading={loading}
                                    />
                                </View>
                            </View>
                        </View>
                    </ScrollView>
                </DismissKeyboardView>
            </KeyboardAvoidingView>
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
        flex: 1,
        backgroundColor: colors.secondary,
        width: "100%",
        marginTop: 32,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
    },
    sheetCont: {
        flex: 1,
        width: "100%",
        maxWidth: maxContentWidth,
        alignSelf: "center",
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
    nameCont: {
        marginBottom: 16,
    },
    nameLabel: {
        fontSize: 16,
    },
    nameBox: {
        width: "100%",
        height: 48,
        backgroundColor: colors.lightGrey2,
        borderRadius: 8,
        marginTop: 8,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        borderWidth: 1,
        borderColor: "transparent",
    },
    nameBoxError: {
        borderColor: "#d32f2f",
    },
    nameValue: {
        flex: 1,
        fontSize: 16,
        fontFamily: "Albert-SemiBold",
        color: "#222",
    },
    nameHint: {
        fontSize: 14,
        color: colors.lightGrey3,
    },
    nameError: {
        marginTop: 6,
        fontSize: 13,
        color: "#d32f2f",
    },
    retryText: {
        color: colors.primaryBlue,
        fontFamily: "Albert-SemiBold",
    },
});
