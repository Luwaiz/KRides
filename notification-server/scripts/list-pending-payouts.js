/**
 * Manual-payout queue: lists every ride whose driver hasn't been paid yet
 * (payoutStatus 'pending_manual', the normal state while PAYOUT_MODE=manual,
 * plus legacy 'failed' rides left over from before that switch), grouped by
 * driver with their bank details, so you can pay each driver in one transfer
 * via the Flutterwave dashboard (or your bank app) instead of per-ride.
 *
 * Run from the notification-server directory, where FIREBASE_ADMIN_SDK is
 * already available as an environment variable (e.g. Render's Shell tab):
 *
 *   node scripts/list-pending-payouts.js
 *
 * After paying a driver, mark their rides settled so they drop off this
 * list and never get paid twice:
 *
 *   node scripts/mark-payout-paid.js <rideId> [rideId2 ...]
 */
const admin = require('firebase-admin');

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
    const snap = await db.collection('rides')
        .where('payoutStatus', 'in', ['pending_manual', 'failed', 'awaiting_bank_details'])
        .get();

    if (snap.empty) {
        console.log('✅ Nothing owed — no rides pending payout.');
        process.exit(0);
    }

    // Group by driver
    const byDriver = new Map();
    for (const doc of snap.docs) {
        const ride = doc.data();
        const driverId = ride.driverId;
        if (!driverId) continue; // shouldn't happen, but don't crash on bad data

        if (!byDriver.has(driverId)) byDriver.set(driverId, []);
        byDriver.get(driverId).push({
            rideId: doc.id,
            amount: Number(ride.payoutAmount) || 0,
            completedAt: ride.completedAt?.toDate?.() || null,
            status: ride.payoutStatus,
        });
    }

    console.log(`\n💰 ${byDriver.size} driver(s) owed money across ${snap.size} ride(s):\n`);

    let grandTotal = 0;

    for (const [driverId, rides] of byDriver) {
        const driverSnap = await db.collection('drivers').doc(driverId).get();
        const driver = driverSnap.exists ? driverSnap.data() : null;
        const total = rides.reduce((sum, r) => sum + r.amount, 0);
        grandTotal += total;

        console.log('─'.repeat(60));
        console.log(`Driver: ${driver?.fullname || driver?.name || '(unknown name)'} (${driverId})`);
        if (driver?.bankName && driver?.accountNumber) {
            console.log(`Bank:   ${driver.bankName} — ${driver.accountNumber} (${driver.accountName || 'name not on file'})`);
        } else {
            console.log(`Bank:   ⚠️ No bank details on file — cannot pay until the driver adds them`);
        }
        console.log(`Owed:   ₦${total.toLocaleString('en-NG')} across ${rides.length} ride(s)`);
        for (const r of rides) {
            const date = r.completedAt ? r.completedAt.toLocaleDateString('en-NG') : 'unknown date';
            console.log(`   - ${r.rideId}  ₦${r.amount.toLocaleString('en-NG')}  (${r.status}, completed ${date})`);
        }
    }

    console.log('─'.repeat(60));
    console.log(`\nGrand total owed: ₦${grandTotal.toLocaleString('en-NG')}\n`);
    console.log('After paying a driver, mark their rides settled:');
    console.log('  node scripts/mark-payout-paid.js <rideId> [rideId2 ...]\n');

    process.exit(0);
}

main().catch((err) => {
    console.error('❌ Failed:', err.message);
    process.exit(1);
});
