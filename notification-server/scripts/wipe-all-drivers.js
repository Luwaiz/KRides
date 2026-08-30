/**
 * DESTRUCTIVE — for resetting to a clean slate before real driver signups
 * begin. Deletes every driver's Firebase Auth account (permanent, cannot
 * be undone), their drivers/{uid} Firestore doc, and their
 * driver_locations/{uid} doc.
 *
 * Does NOT touch rides, payouts, refunds, or driverReports — those already
 * have driver name/phone/email copied onto them, so they stay readable as
 * historical record even after the driver account is gone, and wiping
 * financial/business history is a separate decision this script won't make
 * as a side effect.
 *
 * Dry-run by default — lists every driver that would be deleted without
 * touching anything. Pass --confirm to actually delete.
 *
 * Run from the notification-server directory, where FIREBASE_ADMIN_SDK is
 * already available as an environment variable (e.g. Render's Shell tab):
 *
 *   node scripts/wipe-all-drivers.js            # dry run — just lists
 *   node scripts/wipe-all-drivers.js --confirm  # actually deletes
 */
const admin = require('firebase-admin');

const confirmed = process.argv.includes('--confirm');

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
    const snap = await db.collection('drivers').get();

    if (snap.empty) {
        console.log('✅ No drivers found — nothing to clean up.');
        process.exit(0);
    }

    console.log(`\nFound ${snap.size} driver(s):\n`);
    for (const doc of snap.docs) {
        const d = doc.data();
        console.log(`  - ${doc.id}  ${d.fullname || d.name || '(no name)'}  ${d.phone || ''}  ${d.email || ''}`);
    }

    if (!confirmed) {
        console.log(`\nThis was a DRY RUN — nothing was deleted.`);
        console.log(`Running with --confirm deletes each driver's Firebase Auth account (permanent —`);
        console.log(`cannot be undone), their drivers/{uid} Firestore doc, and their driver_locations/{uid} doc.`);
        console.log(`Rides, payouts, refunds, and driverReports are NOT touched.`);
        console.log(`\nTo actually delete all ${snap.size} driver(s), run:`);
        console.log(`  node scripts/wipe-all-drivers.js --confirm\n`);
        process.exit(0);
    }

    console.log(`\n⚠️  Deleting ${snap.size} driver(s) — Auth accounts, Firestore docs, and location docs...\n`);

    const uids = snap.docs.map((doc) => doc.id);

    // Firebase Auth allows up to 1000 UIDs per deleteUsers() call.
    const chunks = [];
    for (let i = 0; i < uids.length; i += 1000) chunks.push(uids.slice(i, i + 1000));

    let authDeleted = 0;
    let authFailed = 0;
    for (const chunk of chunks) {
        const result = await admin.auth().deleteUsers(chunk);
        authDeleted += result.successCount;
        authFailed += result.failureCount;
        for (const err of result.errors) {
            console.error(`   ⚠️ Auth delete failed for ${chunk[err.index]}: ${err.error.message}`);
        }
    }

    // bulkWriter().delete() on a doc that doesn't exist (e.g. a driver with
    // no driver_locations doc yet) is a silent no-op, not an error.
    const bulkWriter = db.bulkWriter();
    for (const uid of uids) {
        bulkWriter.delete(db.collection('drivers').doc(uid));
        bulkWriter.delete(db.collection('driver_locations').doc(uid));
    }
    await bulkWriter.close();

    console.log(`\n✅ Done. Auth accounts deleted: ${authDeleted}${authFailed ? ` (${authFailed} failed, see above)` : ''}.`);
    console.log(`   Firestore drivers/ and driver_locations/ docs deleted for all ${uids.length} driver ID(s).`);
    console.log(`   Rides, payouts, refunds, and driverReports were left untouched.\n`);

    process.exit(0);
}

main().catch((err) => {
    console.error('❌ Failed:', err.message);
    process.exit(1);
});
