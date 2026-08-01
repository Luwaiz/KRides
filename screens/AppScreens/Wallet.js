import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Share,
    ScrollView,
    TextInput,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import BackButton from '../../components/buttons/BackButton';
import { colors } from '../../constants/styling';
import { sp, fs, br } from '../../constants/responsive';
import { FIREBASE_AUTH, FIREBASE_DB } from '../../firebaseConfig';
import { useUserDetails } from '../../constants/Store';
import { createTopupAccount } from '../../helpers/walletHelpers';

const MIN_TOPUP = 100;
const TOPUP_ACCOUNT_KEY_PREFIX = 'pending_topup_account_';

const Wallet = () => {
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState([]);

    // Top-up flow state
    const [topupAmount, setTopupAmount] = useState('');
    const [creating, setCreating] = useState(false);
    const [topupAccount, setTopupAccount] = useState(null); // { accountNumber, bankName, accountName, amount, expiryDate }
    const [error, setError] = useState(null);

    const user = FIREBASE_AUTH.currentUser;
    const firstName = useUserDetails((s) => s.firstName);
    const lastName = useUserDetails((s) => s.lastName);

    // Real-time balance listener
    useEffect(() => {
        if (!user) return;
        const unsub = onSnapshot(
            doc(FIREBASE_DB, 'users', user.uid),
            (snap) => { if (snap.exists()) setBalance(snap.data().walletBalance ?? 0); },
            () => {}
        );
        return () => unsub();
    }, [user?.uid]);

    // Real-time transaction history
    useEffect(() => {
        if (!user) return;
        const q = query(
            collection(FIREBASE_DB, 'users', user.uid, 'walletTransactions'),
            orderBy('createdAt', 'desc'),
            limit(50)
        );
        const unsub = onSnapshot(q, (snap) => {
            setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }, (err) => console.error('❌ walletTransactions listener error:', err));
        return () => unsub();
    }, [user?.uid]);

    // Restore a still-pending top-up account if the rider navigated away
    // (e.g. to their banking app) and came back — previously this was plain
    // component state, so leaving the screen lost the account details with
    // no way to see them again short of generating a brand new one.
    useEffect(() => {
        if (!user) return;
        AsyncStorage.getItem(TOPUP_ACCOUNT_KEY_PREFIX + user.uid)
            .then((raw) => {
                if (!raw) return;
                const saved = JSON.parse(raw);
                if (saved.expiryDate && new Date(saved.expiryDate) < new Date()) {
                    AsyncStorage.removeItem(TOPUP_ACCOUNT_KEY_PREFIX + user.uid).catch(() => {});
                    return;
                }
                setTopupAccount(saved);
            })
            .catch(() => {});
    }, [user?.uid]);

    const handleGenerateAccount = async () => {
        const amount = Number(topupAmount);
        if (!amount || amount < MIN_TOPUP) {
            setError(`Minimum top-up is ₦${MIN_TOPUP}`);
            return;
        }
        setCreating(true);
        setError(null);
        setTopupAccount(null);
        try {
            const fullName = `${firstName || ''} ${lastName || ''}`.trim() || 'KRides User';
            const result = await createTopupAccount(user.uid, user.email, fullName, amount);
            setTopupAccount(result);
            setTopupAmount('');
            AsyncStorage.setItem(TOPUP_ACCOUNT_KEY_PREFIX + user.uid, JSON.stringify(result)).catch(() => {});
        } catch (err) {
            console.error('❌ Top-up account error:', err);
            setError('Could not generate account. Please try again.');
        } finally {
            setCreating(false);
        }
    };

    const handleShare = async () => {
        if (!topupAccount) return;
        try {
            await Share.share({
                message: `KRides Wallet Top-up\nBank: ${topupAccount.bankName}\nAccount number: ${topupAccount.accountNumber}\nAccount name: ${topupAccount.accountName}\nAmount: ₦${topupAccount.amount?.toLocaleString('en-NG')}`,
            });
        } catch (error) {
            console.warn('⚠️ Share failed:', error.message);
            Toast.show({
                type: 'tomatoToast',
                text1: 'Could Not Share',
                text2: 'Please try again or copy the details manually.',
                position: 'top',
            });
        }
    };

    const formatBalance = (amount) =>
        `₦${Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
        <SafeAreaView style={styles.container}>
            <BackButton text={<Text style={styles.headText}>Wallet</Text>} />

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    {/* Balance card */}
                    <View style={styles.balanceCard}>
                        <MaterialCommunityIcons name="wallet-outline" size={28} color="rgba(255,255,255,0.8)" />
                        <Text style={styles.balanceLabel}>Available Balance</Text>
                        <Text style={styles.balanceAmount}>{formatBalance(balance)}</Text>
                    </View>

                    {/* Top-up section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Add Money</Text>
                        <Text style={styles.sectionSubtitle}>
                            Enter the amount you want to add, then transfer exactly that amount to the generated account number.
                        </Text>

                        {/* Amount input */}
                        {!topupAccount && (
                            <View style={styles.inputCard}>
                                <Text style={styles.inputLabel}>Amount (₦)</Text>
                                <View style={styles.inputRow}>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="e.g. 2000"
                                        placeholderTextColor={colors.lightGrey3}
                                        keyboardType="numeric"
                                        value={topupAmount}
                                        onChangeText={(t) => { setTopupAmount(t.replace(/[^0-9]/g, '')); setError(null); }}
                                        maxLength={7}
                                    />
                                    <TouchableOpacity
                                        style={[styles.generateBtn, creating && styles.generateBtnDisabled]}
                                        onPress={handleGenerateAccount}
                                        disabled={creating}
                                    >
                                        {creating
                                            ? <ActivityIndicator size="small" color="white" />
                                            : <Text style={styles.generateBtnText}>Generate Account</Text>
                                        }
                                    </TouchableOpacity>
                                </View>
                                {error && <Text style={styles.errorText}>{error}</Text>}
                            </View>
                        )}

                        {/* Generated account details */}
                        {topupAccount && (
                            <View style={styles.accountCard}>
                                <View style={styles.amountBadge}>
                                    <Text style={styles.amountBadgeText}>
                                        Transfer exactly ₦{topupAccount.amount?.toLocaleString('en-NG')}
                                    </Text>
                                </View>

                                <View style={styles.accountRow}>
                                    <Text style={styles.accountLabel}>Bank</Text>
                                    <Text style={styles.accountValue}>{topupAccount.bankName}</Text>
                                </View>
                                <View style={styles.divider} />
                                <View style={styles.accountRow}>
                                    <Text style={styles.accountLabel}>Account Number</Text>
                                    <Text style={styles.accountNumberValue}>{topupAccount.accountNumber}</Text>
                                </View>
                                <View style={styles.divider} />
                                <View style={styles.accountRow}>
                                    <Text style={styles.accountLabel}>Account Name</Text>
                                    <Text style={styles.accountValue}>{topupAccount.accountName}</Text>
                                </View>

                                {topupAccount.expiryDate && (
                                    <>
                                        <View style={styles.divider} />
                                        <View style={styles.accountRow}>
                                            <Text style={styles.accountLabel}>Expires</Text>
                                            <Text style={styles.accountValue}>{topupAccount.expiryDate}</Text>
                                        </View>
                                    </>
                                )}

                                <View style={styles.accountActions}>
                                    <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                                        <Ionicons name="share-outline" size={18} color={colors.primaryBlue} />
                                        <Text style={styles.shareText}>Share Details</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.newTopupButton} onPress={() => {
                                        setTopupAccount(null);
                                        if (user) AsyncStorage.removeItem(TOPUP_ACCOUNT_KEY_PREFIX + user.uid).catch(() => {});
                                    }}>
                                        <Text style={styles.newTopupText}>New Top-up</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        <View style={styles.noteBox}>
                            <Ionicons name="information-circle-outline" size={18} color={colors.primaryBlue} />
                            <Text style={styles.noteText}>
                                The account number is valid for one transfer of the exact amount shown. Your balance updates automatically within seconds of the transfer.
                            </Text>
                        </View>
                    </View>

                    {/* Transaction history */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Recent Transactions</Text>
                        {transactions.length === 0 ? (
                            <View style={styles.emptyState}>
                                <MaterialCommunityIcons name="receipt" size={48} color={colors.lightGrey3} />
                                <Text style={styles.emptyText}>No transactions yet</Text>
                                <Text style={styles.emptySubtext}>
                                    Your top-ups and ride payments will appear here.
                                </Text>
                            </View>
                        ) : (
                            transactions.map((txn) => (
                                <View key={txn.id} style={styles.txnCard}>
                                    <View style={styles.txnIconWrap}>
                                        <MaterialCommunityIcons
                                            name={txn.type === 'topup' ? 'arrow-down-circle' : txn.type === 'refund' ? 'refresh-circle' : 'car'}
                                            size={24}
                                            color={txn.type === 'topup' || txn.type === 'refund' ? '#4caf50' : colors.primaryBlue}
                                        />
                                    </View>
                                    <View style={styles.txnInfo}>
                                        <Text style={styles.txnTitle}>
                                            {txn.type === 'topup' ? 'Wallet Top-up'
                                                : txn.type === 'refund' ? 'Ride Refund'
                                                : 'Ride Payment'}
                                        </Text>
                                        <Text style={styles.txnDate}>
                                            {txn.createdAt?.toDate
                                                ? txn.createdAt.toDate().toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                                : '—'}
                                        </Text>
                                    </View>
                                    <Text style={[styles.txnAmount, txn.amount > 0 ? styles.txnAmountCredit : styles.txnAmountDebit]}>
                                        {txn.amount > 0 ? '+' : ''}₦{Math.abs(txn.amount).toLocaleString('en-NG')}
                                    </Text>
                                </View>
                            ))
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default Wallet;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.secondary2,
    },
    headText: {
        color: 'black',
        fontSize: fs(24),
        fontFamily: 'Albert-SemiBold',
    },
    scroll: {
        paddingBottom: sp(32),
    },
    balanceCard: {
        marginHorizontal: sp(16),
        marginTop: sp(16),
        backgroundColor: colors.primaryBlue,
        borderRadius: br(20),
        padding: sp(24),
        alignItems: 'center',
        gap: sp(6),
        shadowColor: colors.primaryBlue,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 8,
    },
    balanceLabel: {
        fontSize: fs(14),
        fontFamily: 'Albert-Regular',
        color: 'rgba(255,255,255,0.8)',
        marginTop: sp(4),
    },
    balanceAmount: {
        fontSize: fs(40),
        fontFamily: 'Albert-Bold',
        color: 'white',
        marginTop: sp(2),
    },
    section: {
        marginHorizontal: sp(16),
        marginTop: sp(24),
    },
    sectionTitle: {
        fontSize: fs(18),
        fontFamily: 'Albert-SemiBold',
        color: 'black',
        marginBottom: sp(6),
    },
    sectionSubtitle: {
        fontSize: fs(13),
        fontFamily: 'Albert-Regular',
        color: colors.lightGrey3,
        lineHeight: fs(20),
        marginBottom: sp(16),
    },
    inputCard: {
        backgroundColor: 'white',
        borderRadius: br(16),
        padding: sp(16),
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
    },
    inputLabel: {
        fontSize: fs(13),
        fontFamily: 'Albert-Regular',
        color: colors.lightGrey3,
        marginBottom: sp(8),
    },
    inputRow: {
        flexDirection: 'row',
        gap: sp(10),
        alignItems: 'center',
    },
    input: {
        flex: 1,
        height: sp(48),
        borderWidth: 1,
        borderColor: colors.lightGrey2,
        borderRadius: br(10),
        paddingHorizontal: sp(14),
        fontSize: fs(16),
        fontFamily: 'Albert-SemiBold',
        color: '#333',
    },
    generateBtn: {
        height: sp(48),
        paddingHorizontal: sp(16),
        backgroundColor: colors.primaryBlue,
        borderRadius: br(10),
        justifyContent: 'center',
        alignItems: 'center',
    },
    generateBtnDisabled: {
        opacity: 0.6,
    },
    generateBtnText: {
        color: 'white',
        fontSize: fs(13),
        fontFamily: 'Albert-SemiBold',
    },
    errorText: {
        fontSize: fs(12),
        fontFamily: 'Albert-Regular',
        color: '#d32f2f',
        marginTop: sp(8),
    },
    accountCard: {
        backgroundColor: 'white',
        borderRadius: br(16),
        paddingHorizontal: sp(20),
        paddingTop: sp(4),
        paddingBottom: sp(4),
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
    },
    amountBadge: {
        backgroundColor: '#e8f5e9',
        borderRadius: br(8),
        padding: sp(10),
        marginVertical: sp(12),
        alignItems: 'center',
    },
    amountBadgeText: {
        fontSize: fs(14),
        fontFamily: 'Albert-SemiBold',
        color: '#2e7d32',
    },
    accountRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: sp(14),
    },
    accountLabel: {
        fontSize: fs(13),
        fontFamily: 'Albert-Regular',
        color: colors.lightGrey3,
        flex: 1,
    },
    accountValue: {
        fontSize: fs(14),
        fontFamily: 'Albert-SemiBold',
        color: '#333',
        flex: 2,
        textAlign: 'right',
    },
    accountNumberValue: {
        fontSize: fs(20),
        fontFamily: 'Albert-Bold',
        color: colors.primaryBlue,
        letterSpacing: 2,
    },
    divider: {
        height: 1,
        backgroundColor: colors.lightGrey2,
    },
    accountActions: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: colors.lightGrey2,
        marginTop: sp(4),
    },
    shareButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: sp(6),
        paddingVertical: sp(14),
    },
    shareText: {
        fontSize: fs(14),
        fontFamily: 'Albert-SemiBold',
        color: colors.primaryBlue,
    },
    newTopupButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: sp(14),
        borderLeftWidth: 1,
        borderLeftColor: colors.lightGrey2,
    },
    newTopupText: {
        fontSize: fs(14),
        fontFamily: 'Albert-SemiBold',
        color: colors.lightGrey3,
    },
    noteBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: sp(8),
        backgroundColor: '#EEF4FF',
        borderRadius: br(10),
        padding: sp(12),
        marginTop: sp(12),
    },
    noteText: {
        flex: 1,
        fontSize: fs(12),
        fontFamily: 'Albert-Regular',
        color: colors.primaryBlue,
        lineHeight: fs(18),
    },
    emptyState: {
        backgroundColor: 'white',
        borderRadius: br(16),
        padding: sp(40),
        alignItems: 'center',
        elevation: 1,
    },
    emptyText: {
        fontSize: fs(16),
        fontFamily: 'Albert-SemiBold',
        color: colors.textGrey,
        marginTop: sp(12),
    },
    emptySubtext: {
        fontSize: fs(13),
        fontFamily: 'Albert-Regular',
        color: colors.lightGrey3,
        textAlign: 'center',
        marginTop: sp(6),
        lineHeight: fs(20),
    },
    txnCard: {
        backgroundColor: 'white',
        borderRadius: br(12),
        padding: sp(14),
        flexDirection: 'row',
        alignItems: 'center',
        gap: sp(12),
        marginBottom: sp(10),
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    txnIconWrap: {
        width: sp(40),
        height: sp(40),
        borderRadius: br(20),
        backgroundColor: colors.lightGrey2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    txnInfo: {
        flex: 1,
    },
    txnTitle: {
        fontSize: fs(14),
        fontFamily: 'Albert-SemiBold',
        color: '#333',
    },
    txnDate: {
        fontSize: fs(12),
        fontFamily: 'Albert-Regular',
        color: colors.lightGrey3,
        marginTop: sp(2),
    },
    txnAmount: {
        fontSize: fs(15),
        fontFamily: 'Albert-Bold',
    },
    txnAmountCredit: {
        color: '#4caf50',
    },
    txnAmountDebit: {
        color: '#333',
    },
});
