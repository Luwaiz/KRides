
const axios = require("axios");
const admin = require("firebase-admin");

const API_URL = process.env.OLD_API_URL || "http://localhost:3000/api/users";

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
	console.error(
		"Please set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON file."
	);
	process.exit(1);
}

admin.initializeApp();
const db = admin.firestore();

async function fetchOldUsers() {
	console.log("Fetching users from", API_URL);
	const res = await axios.get(API_URL);
	return res.data || [];
}

async function migrate() {
	const users = await fetchOldUsers();
	console.log("Found users:", users.length || 0);
	for (const u of users) {
		const uid = u.firebaseUid || `legacy-${u.id}`;
		const doc = {
			uid,
			name: u.firstName
				? `${u.firstName} ${u.lastName || ""}`.trim()
				: u.name || null,
			email: u.email || null,
			phone: u.phone || null,
			role: u.role || "customer",
			fcmTokens: {},
			createdAt: admin.firestore.FieldValue.serverTimestamp(),
		};
		await db.collection("users").doc(uid).set(doc, { merge: true });
		console.log("Migrated user", uid);
	}
	console.log("Migration complete");
}

migrate().catch((err) => {
	console.error("Migration failed", err);
	process.exit(1);
});
