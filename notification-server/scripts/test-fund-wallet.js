/**
 * One-off dev script: credits a wallet the exact same way the real
 * Flutterwave webhook does (POST /api/wallet/webhook), so you can verify
 * the wallet UI without waiting on a real bank transfer.
 *
 * Run from the notification-server directory, where FIREBASE_ADMIN_SDK is
 * already available as an environment variable (e.g. Render's Shell tab):
 *
 *   node scripts/test-fund-wallet.js <userId> <amountNaira>
 *
 * Example:
 *   node scripts/test-fund-wallet.js reFdepLARHNLVTMTggnX8PGi3GM2 500
 */
const admin = require('firebase-admin');

const [, , userId, amountArg] = process.argv;
const amount = Number(amountArg);

if (!userId || !amount || amount <= 0) {
    console.error('Usage: node scripts/test-fund-wallet.js <userId> <amountNaira>');
    process.exit(1);
}

if (!process.env.FIREBASE_ADMIN_SDK) {
    console.error('❌ FIREBASE_ADMIN_SDK is not set in this environment.');
    process.exit(1);
}

const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_ADMIN_SDK, 'base64').toString('utf8')
);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://kampusride.firebaseio.com',
});

const db = admin.firestore();

async function main() {
    const userRef = db.collection('users').doc(userId);
    const flwTxId = `test_${Date.now()}`;
    const txnRef = userRef.collection('walletTransactions').doc(flwTxId);

    await db.runTransaction(async (txn) => {
        const userSnap = await txn.get(userRef);
        if (!userSnap.exists) {
            throw new Error(`User not found: ${userId}`);
        }

        txn.update(userRef, {
            walletBalance: admin.firestore.FieldValue.increment(amount),
        });

        txn.set(txnRef, {
            userId,
            type: 'topup',
            amount,
            rideId: null,
            flwTxRef: `test_topup_${userId}_${Date.now()}`,
            flwTxId,
            status: 'completed',
            note: 'Manual test credit — not backed by a real transfer',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });

    console.log(`✅ Credited ₦${amount} to ${userId}. Check the Wallet screen — balance and transaction history should update in real time.`);
    process.exit(0);
}

main().catch((err) => {
    console.error('❌ Failed:', err.message);
    process.exit(1);
});
