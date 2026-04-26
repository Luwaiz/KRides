import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Share,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import BackButton from '../../components/buttons/BackButton';
import { colors } from '../../constants/styling';
import { sp, fs, br } from '../../constants/responsive';
import { FIREBASE_AUTH, FIREBASE_DB } from '../../firebaseConfig';
import { useUserDetails } from '../../constants/Store';
import { createOrGetVirtualAccount } from '../../helpers/walletHelpers';

const Wallet = () => {
    const [accountNumber, setAccountNumber] = useState(null);
    const [bankName, setBankName] = useState(null);
    const [accountName, setAccountName] = useState(null);
    const [balance, setBalance] = useState(0);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState(null);
    const [transactions, setTransactions] = useState([]);

    const user = FIREBASE_AUTH.currentUser;
    const firstName = useUserDetails((s) => s.firstName);
    const lastName = useUserDetails((s) => s.lastName);

    // Real-time listener on the user doc — balance and virtual account details
    useEffect(() => {
        if (!user) return;

        const unsub = onSnapshot(
            doc(FIREBASE_DB, 'users', user.uid),
            (snap) => {
                if (!snap.exists()) return;
                const data = snap.data();
                setBalance(data.walletBalance ?? 0);
                if (data.virtualAccountNumber) {
                    setAccountNumber(data.virtualAccountNumber);
                    setBankName(data.virtualAccountBank || '');
                    setAccountName(data.virtualAccountName || '');
                    setLoading(false);
                }
            },
            (err) => {
                console.error('❌ Wallet snapshot error:', err);
                setLoading(false);
            }
        );

        return () => unsub();
    }, [user?.uid]);

    // Real-time transaction history — newest 50 entries
    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(FIREBASE_DB, 'users', user.uid, 'walletTransactions'),
            orderBy('createdAt', 'desc'),
            limit(50)
        );

        const unsub = onSnapshot(q, (snap) => {
            setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }, () => {});

        return () => unsub();
    }, [user?.uid]);

    // If the snapshot finished loading and there's still no account number,
    // trigger creation via the server.
    useEffect(() => {
        if (!loading || !user) return;

        // Give the snapshot a moment to resolve from cache before hitting the server
        const timer = setTimeout(async () => {
            // Re-check: snapshot may have populated accountNumber by now
            if (accountNumber) return;

            setCreating(true);
            setError(null);
            try {
                const fullName = `${firstName || ''} ${lastName || ''}`.trim();
                const result = await createOrGetVirtualAccount(
                    user.uid,
                    user.email,
                    fullName
                );
                // The onSnapshot listener will pick up the Firestore write and
                // update state automatically, but set locally as a fast path.
                setAccountNumber(result.accountNumber);
                setBankName(result.bankName);
                setAccountName(result.accountName);
            } catch (err) {
                console.error('❌ Virtual account creation error:', err);
                setError('Could not set up your wallet. Please try again.');
            } finally {
                setCreating(false);
                setLoading(false);
            }
        }, 1500);

        return () => clearTimeout(timer);
    }, [loading, user?.uid]);

    const handleShare = async () => {
        if (!accountNumber) return;
        try {
            await Share.share({
                message: `KRides Wallet\nBank: ${bankName}\nAccount number: ${accountNumber}\nAccount name: ${accountName}`,
            });
        } catch (err) {
            // User dismissed share sheet — not an error
        }
    };

    const handleRetry = () => {
        setLoading(true);
        setError(null);
    };

    const formatBalance = (amount) =>
        `₦${Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
        <SafeAreaView style={styles.container}>
            <BackButton text={<Text style={styles.headText}>Wallet</Text>} />

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                {/* Balance card */}
                <View style={styles.balanceCard}>
                    <MaterialCommunityIcons name="wallet-outline" size={28} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.balanceLabel}>Available Balance</Text>
                    <Text style={styles.balanceAmount}>{formatBalance(balance)}</Text>
                </View>

                {/* Virtual account section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Add Money</Text>
                    <Text style={styles.sectionSubtitle}>
                        Transfer any amount to the account below. Your balance updates automatically within seconds.
                    </Text>

                    {loading || creating ? (
                        <View style={styles.loadingCard}>
                            <ActivityIndicator size="large" color={colors.primaryBlue} />
                            <Text style={styles.loadingText}>
                                {creating ? 'Setting up your wallet...' : 'Loading account details...'}
                            </Text>
                        </View>
                    ) : error ? (
                        <View style={styles.errorCard}>
                            <Ionicons name="alert-circle-outline" size={32} color="#d32f2f" />
                            <Text style={styles.errorText}>{error}</Text>
                            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                                <Text style={styles.retryText}>Try Again</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.accountCard}>
                            <View style={styles.accountRow}>
                                <Text style={styles.accountLabel}>Bank</Text>
                                <Text style={styles.accountValue}>{bankName}</Text>
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.accountRow}>
                                <Text style={styles.accountLabel}>Account Number</Text>
                                <View style={styles.accountNumberRow}>
                                    <Text style={styles.accountNumberValue}>{accountNumber}</Text>
                                </View>
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.accountRow}>
                                <Text style={styles.accountLabel}>Account Name</Text>
                                <Text style={styles.accountValue}>{accountName}</Text>
                            </View>

                            <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                                <Ionicons name="share-outline" size={18} color={colors.primaryBlue} />
                                <Text style={styles.shareText}>Share Account Details</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <View style={styles.noteBox}>
                        <Ionicons name="information-circle-outline" size={18} color={colors.primaryBlue} />
                        <Text style={styles.noteText}>
                            This account number is unique to you. Any transfer made to it will be credited to your KRides wallet.
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
    loadingCard: {
        backgroundColor: 'white',
        borderRadius: br(16),
        padding: sp(32),
        alignItems: 'center',
        gap: sp(12),
        elevation: 2,
    },
    loadingText: {
        fontSize: fs(14),
        fontFamily: 'Albert-Regular',
        color: colors.lightGrey3,
    },
    errorCard: {
        backgroundColor: 'white',
        borderRadius: br(16),
        padding: sp(24),
        alignItems: 'center',
        gap: sp(12),
        elevation: 2,
    },
    errorText: {
        fontSize: fs(14),
        fontFamily: 'Albert-Regular',
        color: '#d32f2f',
        textAlign: 'center',
    },
    retryButton: {
        paddingHorizontal: sp(24),
        paddingVertical: sp(10),
        backgroundColor: colors.primaryBlue,
        borderRadius: br(8),
        marginTop: sp(4),
    },
    retryText: {
        color: 'white',
        fontSize: fs(14),
        fontFamily: 'Albert-SemiBold',
    },
    accountCard: {
        backgroundColor: 'white',
        borderRadius: br(16),
        paddingHorizontal: sp(20),
        paddingVertical: sp(8),
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
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
    accountNumberRow: {
        flex: 2,
        alignItems: 'flex-end',
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
    shareButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: sp(8),
        paddingVertical: sp(14),
        marginTop: sp(4),
        borderTopWidth: 1,
        borderTopColor: colors.lightGrey2,
    },
    shareText: {
        fontSize: fs(14),
        fontFamily: 'Albert-SemiBold',
        color: colors.primaryBlue,
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
