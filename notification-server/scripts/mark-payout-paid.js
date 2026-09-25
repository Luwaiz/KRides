const admin = require('firebase-admin');

const rideIds = process.argv.slice(2);

if (rideIds.length === 0) {
    console.error('Usage: node scripts/mark-payout-paid.js <rideId> [rideId2 ...]');
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
    const paidByDriver = new Map();

    for (const rideId of rideIds) {
        const rideRef = db.collection('rides').doc(rideId);
        const rideSnap = await rideRef.get();

        if (!rideSnap.exists) {
            console.error(`⚠️  ${rideId}: not found — skipped`);
            continue;
        }

        const ride = rideSnap.data();
        if (ride.payoutStatus === 'paid_manually') {
            console.log(`ℹ️  ${rideId}: already marked paid — skipped`);
            continue;
        }

        await rideRef.update({
            payoutStatus: 'paid_manually',
            payoutPaidAt: admin.firestore.FieldValue.serverTimestamp(),
            payoutError: admin.firestore.FieldValue.delete(),
        });
        console.log(`✅ ${rideId}: marked paid (₦${Number(ride.payoutAmount) || 0})`);

        if (ride.driverId) {
            const amount = Number(ride.payoutAmount) || 0;
            paidByDriver.set(ride.driverId, (paidByDriver.get(ride.driverId) || 0) + amount);
        }
    }

    for (const [driverId, amount] of paidByDriver) {
        if (amount <= 0) continue;
        await db.collection('drivers').doc(driverId).update({
            totalPaidOut: admin.firestore.FieldValue.increment(amount),
        });
    }

    process.exit(0);
}

main().catch((err) => {
    console.error('❌ Failed:', err.message);
    process.exit(1);
});
