import React, { useEffect, useMemo, useState } from "react";
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
import BankPicker from "../../components/BankPicker";
import { FIREBASE_AUTH } from "../../firebaseConfig";
import { NOTIFICATION_API_KEY } from "@env";
import useAuthStore, { useDriverDetails, useUserDetails } from "../../constants/Store";
import { signOut } from "firebase/auth";
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
    // Set when a driver hasn't saved verified bank details yet; the app shows only this
    // screen (no back button, no dashboard) until they have.
    const isRequired = !!route?.params?.required;

    const { fullName, phone, uid, existingBankCode, existingAccountNumber, existingAccountName } = useDriverDetails((state) => ({
        fullName: state.fullName,
        phone: state.phone,
        uid: state.uid || FIREBASE_AUTH.currentUser?.uid,
        existingBankCode: state.bankCode,
        existingAccountNumber: state.accountNumber,
        existingAccountName: state.accountName,
    }));

    // No bank is preselected, so nobody saves the first bank in the list by mistake.
    const [bankCode, setBankCode] = useState((isEditing && existingBankCode) || "");
    const [banks, setBanks] = useState(NIGERIAN_BANKS);

    // Load the full bank list from the server (Flutterwave's own codes). The built-in list
    // stays as the fallback if that fails.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const currentUser = FIREBASE_AUTH.currentUser;
                if (!currentUser) return;
                const idToken = await currentUser.getIdToken();
                const response = await fetch(`${PAYMENTS_SERVER_URL}/banks`, {
                    headers: {
                        "x-api-key": NOTIFICATION_API_KEY || "",
                        "Authorization": `Bearer ${idToken}`,
                    },
                });
                const result = await response.json().catch(() => null);
                if (cancelled || !response.ok || !Array.isArray(result?.banks) || !result.banks.length) return;
                setBanks(result.banks);
            } catch (error) {
                console.warn("⚠️ Could not load bank list, using built-in list:", error.message);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Keep a saved bank selectable even if it's missing from the loaded list.
    const bankOptions = useMemo(() => {
        if (!bankCode || banks.some((b) => b.value === bankCode)) return banks;
        const known = NIGERIAN_BANKS.find((b) => b.value === bankCode);
        return known ? [known, ...banks] : banks;
    }, [banks, bankCode]);
    const [accountNumber, setAccountNumber] = useState(isEditing ? existingAccountNumber || "" : "");
    const [accountName, setAccountName] = useState(isEditing ? existingAccountName || "" : "");
    const [loading, setLoading] = useState(false);

    // The account name is looked up from the bank as soon as a full number is entered.
    // resolved is the bank + number a confirmed name belongs to, and that name.
    const [resolved, setResolved] = useState(
        isEditing && existingBankCode && existingAccountNumber && existingAccountName
            ? { key: `${existingBankCode}:${existingAccountNumber}`, name: existingAccountName }
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
        // Back to a bank and number that already have a confirmed name: show it again
        // instead of leaving the name blank with nothing left to trigger a lookup.
        if (resolved && key === resolved.key) {
            setAccountName(resolved.name);
            return;
        }

        setAccountName("");
        if (!bankCode || !/^\d{10}$/.test(accountNumber)) {
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
                    setResolved({ key, name: result.accountName });
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
        if (!bankCode) {
            Alert.alert("Choose Your Bank", "Select the bank your account is with.");
            return;
        }
        if (!accountNumber || !/^\d{10}$/.test(accountNumber)) {
            Alert.alert("Invalid Account Number", "Nigerian bank account numbers must be exactly 10 digits.");
            return;
        }
        if (!manualName && (resolved?.key !== `${bankCode}:${accountNumber}` || !accountName)) {
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

        // Saving can involve several calls to the payment provider, and a sleeping server
        // takes a while to wake, so allow a minute but never spin forever.
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        try {
            const selectedBank = bankOptions.find((b) => b.value === bankCode);
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
                signal: controller.signal,
            });

            // An error page from a proxy or a waking server isn't JSON.
            const result = await response.json().catch(() => null);

            // The server saves the bank details and marks them verified once Flutterwave
            // confirms the account; the app only mirrors them into local state.
            if (response.ok && result?.success) {
                const verifiedBankName = result.data?.bank_name || bankName;
                const verifiedAccountName = result.data?.verified_account_name || accountName;

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
                Alert.alert(
                    "Could Not Save",
                    result?.error || "Something went wrong on our side. Please try again in a moment."
                );
            }
        } catch (error) {
            console.error("Error saving bank details:", error);
            Alert.alert(
                "Could Not Save",
                error.name === "AbortError"
                    ? "This is taking too long. Check your connection and try again."
                    : "Couldn't reach the server. Check your connection and try again."
            );
        } finally {
            clearTimeout(timeoutId);
            setLoading(false);
        }
    };

    // Opened from inside the app (profile, "Set up now"), go back to where the driver came
    // from; replacing would stack a second home screen with its own listeners and popups.
    // Only right after sign-up, when this is the first screen, open home in its place.
    const leaveScreen = () => {
        // Required setup: the app swaps to the dashboard on its own the moment the bank
        // details are marked verified, so there is nowhere to navigate to from here.
        if (isRequired) return;
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            navigation.replace("DriverHome");
        }
    };

    // Bank details are compulsory for drivers. This is the only way out of the required
    // screen besides saving them, so a driver on the wrong account isn't trapped here.
    const handleLogOut = () => {
        Alert.alert("Log out?", "You'll need to add your bank details before you can drive.", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Log out",
                style: "destructive",
                onPress: async () => {
                    await signOut(FIREBASE_AUTH).catch(() => {});
                    useUserDetails.getState().clearUser();
                    useDriverDetails.getState().clearDriver();
                    useAuthStore.getState().clearAuth();
                },
            },
        ]);
    };

    return (
        <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <DismissKeyboardView>
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{ flexGrow: 1 }}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={styles.topCont}>
                            <View style={[styles.headerRow, isRequired && { paddingRight: 16 }]}>
                                {isRequired ? (
                                    <>
                                        <View style={styles.requiredTitle}>
                                            <Text style={styles.headText}>Bank Details</Text>
                                        </View>
                                        <TouchableOpacity onPress={handleLogOut} disabled={loading}>
                                            <Text style={styles.skipText}>Log out</Text>
                                        </TouchableOpacity>
                                    </>
                                ) : (
                                    <BackButton text={<Text style={styles.headText}>{isEditing ? "Edit Bank Details" : "Bank Details"}</Text>} />
                                )}
                            </View>
                        </View>
                        <View style={styles.bottomCont}>
                            <View style={styles.sheetCont}>
                                <Text style={styles.subText}>
                                    {isEditing
                                        ? "Update your bank account details below."
                                        : "Add your bank account to start driving. This is where your earnings are paid."}
                                </Text>

                                <BankPicker
                                    banks={bankOptions}
                                    value={bankCode}
                                    onChange={setBankCode}
                                    disabled={loading}
                                />

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
                                                    {resolveError
                                                        ? "Not verified"
                                                        : !bankCode
                                                            ? "Choose your bank first"
                                                            : "Shows up once you enter your account number"}
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
    requiredTitle: {
        flex: 1,
        paddingHorizontal: 16,
        marginTop: 10,
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
