/**
 * Script to upload locations to Firestore
 * Run with: node scripts/upload_locations.js
 * Requires .env in the project root with FIREBASE_API_KEY and FIREBASE_APP_ID set.
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const { initializeApp } = require("firebase/app");
const { getFirestore, collection, doc, setDoc } = require("firebase/firestore");

if (!process.env.FIREBASE_API_KEY || !process.env.FIREBASE_APP_ID) {
	console.error("❌ FIREBASE_API_KEY and FIREBASE_APP_ID must be set in your .env file");
	process.exit(1);
}

const firebaseConfig = {
	apiKey: process.env.FIREBASE_API_KEY,
	authDomain: process.env.FIREBASE_AUTH_DOMAIN || "kampusride.firebaseapp.com",
	projectId: process.env.FIREBASE_PROJECT_ID || "kampusride",
	storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "kampusride.firebasestorage.app",
	messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "1054058095059",
	appId: process.env.FIREBASE_APP_ID,
	measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-GJK6Q51CPP",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Sample locations data
const locations = [
	{
		id: "sat-building",
		name: "School of Science and Technology (SAT)",
		type: "academic",
		coordinates: { latitude: 6.8887163, longitude: 3.7225462 },
		address: "Babcock University, Ilishan-Remo",
		category: "academic",
		popular: true,
	},
	{
		id: "cafeteria",
		name: "Cafeteria (Caf)",
		type: "dining",
		coordinates: { latitude: 6.8926805, longitude: 3.7236058 },
		address: "Babcock University, Ilishan-Remo",
		category: "food",
		popular: true,
	},
	{
		id: "bgh-hall",
		name: "Bethel Girls Hall (BGH)",
		type: "residential",
		coordinates: { latitude: 6.8905112, longitude: 3.7199223 },
		address: "Babcock University, Ilishan-Remo",
		category: "hostel",
		popular: false,
	},
	{
		id: "busa-building",
		name: "BUSA Building",
		type: "administration",
		coordinates: { latitude: 6.8920535, longitude: 3.7237593 },
		address: "Babcock University, Ilishan-Remo",
		category: "student-affairs",
		popular: true,
	},
	{
		id: "pioneer-church",
		name: "Pioneer Church",
		type: "religious",
		coordinates: { latitude: 6.8896079, longitude: 3.7195952 },
		address: "Babcock University, Ilishan-Remo",
		category: "worship",
		popular: false,
	},
	{
		id: "registry-senate",
		name: "Registry & Senate Building",
		type: "administration",
		coordinates: { latitude: 6.8888398, longitude: 3.7218848 },
		address: "Babcock University, Ilishan-Remo",
		category: "office",
		popular: false,
	},
	{
		id: "buth-main",
		name: "BUTH (Teaching Hospital)",
		type: "medical",
		coordinates: { latitude: 6.891771, longitude: 3.718577 },
		address: "Babcock University, Ilishan-Remo",
		category: "health",
		popular: true,
	},
	{
		id: "buth-600-seater",
		name: "BUTH 600-Seater",
		type: "medical",
		coordinates: { latitude: 6.891257, longitude: 3.716952 },
		address: "Babcock University, Ilishan-Remo",
		category: "health",
		popular: false,
	},
	{
		id: "babcock-gate",
		name: "Babcock Main Gate",
		type: "landmark",
		coordinates: { latitude: 6.8890757, longitude: 3.7200411 },
		address: "Babcock University, Ilishan-Remo",
		category: "campus-entrance",
		popular: true,
	},
	{
		id: "diamond-hall",
		name: "Diamond Hall",
		type: "residential",
		coordinates: { latitude: 6.892117, longitude: 3.7271929 },
		address: "Babcock University, Ilishan-Remo",
		category: "hostel",
		popular: true,
	},
	{
		id: "sapphire-hall",
		name: "Sapphire Hall",
		type: "residential",
		coordinates: { latitude: 6.89163, longitude: 3.726779 },
		address: "Babcock University, Ilishan-Remo",
		category: "hostel",
		popular: true,
	},
	{
		id: "crystal-hall",
		name: "Crystal Hall",
		type: "residential",
		coordinates: { latitude: 6.8928556, longitude: 3.72774158 },
		address: "Babcock University, Ilishan-Remo",
		category: "hostel",
		popular: false,
	},
	{
		id: "havilah-hall",
		name: "Havilah Hall",
		type: "residential",
		coordinates: { latitude: 6.8948787, longitude: 3.7260748 },
		address: "Babcock University, Ilishan-Remo",
		category: "hostel",
		popular: false,
	},
	{
		id: "white-hall",
		name: "White Hall",
		type: "residential",
		coordinates: { latitude: 6.8937701, longitude: 3.7263304 },
		address: "Babcock University, Ilishan-Remo",
		category: "hostel",
		popular: false,
	},
	{
		id: "ogden-hall",
		name: "Ogden Hall",
		type: "residential",
		coordinates: { latitude: 6.892621, longitude: 3.726414 },
		address: "Babcock University, Ilishan-Remo",
		category: "hostel",
		popular: false,
	},
	{
		id: "nyberg-hall",
		name: "Nyberg Hall",
		type: "residential",
		coordinates: { latitude: 6.8925971, longitude: 3.7253785 },
		address: "Babcock University, Ilishan-Remo",
		category: "hostel",
		popular: false,
	},
	{
		id: "bbs",
		name: "Babcock Business School (BBS)",
		type: "academic",
		coordinates: { latitude: 6.890815, longitude: 3.7239076 },
		address: "Babcock University, Ilishan-Remo",
		category: "academic",
		popular: true,
	},
	{
		id: "nursing-building",
		name: "Nursing Academic Building",
		type: "academic",
		coordinates: { latitude: 6.891388, longitude: 3.722995 },
		address: "Babcock University, Ilishan-Remo",
		category: "academic",
		popular: false,
	},
	{
		id: "amphitheatre",
		name: "Amphitheatre",
		type: "landmark",
		coordinates: { latitude: 6.8908778, longitude: 3.7224233 },
		address: "Babcock University, Ilishan-Remo",
		category: "event-space",
		popular: true,
	},
	{
		id: "buhs",
		name: "Babcock University High School (BUHS)",
		type: "school",
		coordinates: { latitude: 6.8901123, longitude: 3.7189709 },
		address: "Babcock University, Ilishan-Remo",
		category: "secondary",
		popular: false,
	},
	{
		id: "babrite",
		name: "Babrite Superstore",
		type: "commercial",
		coordinates: { latitude: 6.8912348, longitude: 3.7204419 },
		address: "Babcock University, Ilishan-Remo",
		category: "store",
		popular: true,
	},
	{
		id: "bethel-hall",
		name: "Bethel Hall",
		type: "residential",
		coordinates: { latitude: 6.8946086, longitude: 3.7230729 },
		address: "Babcock University, Ilishan-Remo",
		category: "hostel",
		popular: false,
	},
	{
		id: "topaz-hall",
		name: "Topaz Hall",
		type: "residential",
		coordinates: { latitude: 6.8934622, longitude: 3.7206117 },
		address: "Babcock University, Ilishan-Remo",
		category: "hostel",
		popular: false,
	},
	{
		id: "nelson-mandela-hall",
		name: "Nelson Mandela Hall",
		type: "residential",
		coordinates: { latitude: 6.8934727, longitude: 3.7230408 },
		address: "Babcock University, Ilishan-Remo",
		category: "hostel",
		popular: false,
	},
	{
		id: "samuel-akande-hall",
		name: "Samuel Akande Hall",
		type: "residential",
		coordinates: { latitude: 6.8941305, longitude: 3.7236374 },
		address: "Babcock University, Ilishan-Remo",
		category: "hostel",
		popular: false,
	},
	{
		id: "welch-hall",
		name: "Welch Hall",
		type: "residential",
		coordinates: { latitude: 6.8917506, longitude: 3.7214357 },
		address: "Babcock University, Ilishan-Remo",
		category: "hostel",
		popular: false,
	},
	{
		id: "neal-wilson-hall",
		name: "Neal Wilson Hall",
		type: "residential",
		coordinates: { latitude: 6.8930534, longitude: 3.7217164 },
		address: "Babcock University, Ilishan-Remo",
		category: "hostel",
		popular: false,
	},
	{
		id: "winslow-hall",
		name: "Winslow Hall",
		type: "residential",
		coordinates: { latitude: 6.8940085, longitude: 3.7216602 },
		address: "Babcock University, Ilishan-Remo",
		category: "hostel",
		popular: false,
	},
	{
		id: "gideon-troopers-hall",
		name: "Gideon Troopers Hall",
		type: "residential",
		coordinates: { latitude: 6.8944243, longitude: 3.7224928 },
		address: "Babcock University, Ilishan-Remo",
		category: "hostel",
		popular: false,
	},
	{
		id: "emerald-hall",
		name: "Emerald Hall",
		type: "residential",
		coordinates: { latitude: 6.8937019, longitude: 3.7199852 },
		address: "Babcock University, Ilishan-Remo",
		category: "hostel",
		popular: false,
	},
	{
		id: "buss",
		name: "Babcock University Staff School (BUSS)",
		type: "school",
		coordinates: { latitude: 6.892107, longitude: 3.719119 },
		address: "Babcock University, Ilishan-Remo",
		category: "primary",
		popular: false,
	},
	{
		id: "adeleke-hall",
		name: "Adeleke Hall",
		type: "residential",
		coordinates: { latitude: 6.8928003, longitude: 3.7211487 },
		address: "Babcock University, Ilishan-Remo",
		category: "hostel",
		popular: false,
	},
	{
		id: "queen-esther-hall",
		name: "Queen Esther Hall",
		type: "residential",
		coordinates: { latitude: 6.8929791, longitude: 3.7247012 },
		address: "Babcock University, Ilishan-Remo",
		category: "hostel",
		popular: false,
	},
	{
		id: "fad-building",
		name: "Felicia Adebisi Dada (FAD)",
		type: "academic",
		coordinates: { latitude: 6.8936738, longitude: 3.7249784 },
		address: "Babcock University, Ilishan-Remo",
		category: "academic",
		popular: false,
	},
	{
		id: "platinum-hall",
		name: "Platinum Hall",
		type: "residential",
		coordinates: { latitude: 6.8924519, longitude: 3.7274199 },
		address: "Babcock University, Ilishan-Remo",
		category: "hostel",
		popular: false,
	},
	{
		id: "ameyo-building",
		name: "Ameyo Hall",
		type: "residential",
		coordinates: { latitude: 6.8949448, longitude: 3.7249274 },
		address: "Babcock University, Ilishan-Remo",
		category: "hostel",
		popular: false,
	},
	{
		id: "entrepreneurship-center",
		name: "Entrepreneurship Center",
		type: "academic",
		coordinates: { latitude: 6.890512, longitude: 3.725781 },
		address: "Babcock University, Ilishan-Remo",
		category: "academic",
		popular: false,
	},
	{
		id: "laz-otti-library",
		name: "Laz Otti Library",
		type: "academic",
		coordinates: { latitude: 6.8921563, longitude: 3.7223333 },
		address: "Babcock University, Ilishan-Remo",
		category: "library",
		popular: true,
	},
	{
		id: "bucodel",
		name: "BUCodel",
		type: "academic",
		coordinates: { latitude: 6.891593, longitude: 3.723314 },
		address: "Babcock University, Ilishan-Remo",
		category: "tech-center",
		popular: false,
	},
	{
		id: "msq-gate",
		name: "MSQ Gate",
		type: "landmark",
		coordinates: { latitude: 6.895694, longitude: 3.723856 },
		address: "Babcock University, Ilishan-Remo",
		category: "campus-entrance",
		popular: true,
	},
	{
		id: "stadium",
		name: "Stadium",
		type: "recreational",
		coordinates: { latitude: 6.8947221, longitude: 3.7277028 },
		address: "Babcock University, Ilishan-Remo",
		category: "sports",
		popular: true,
	},
	{
		id: "staff-quarters",
		name: "Staff Quarters",
		type: "residential",
		coordinates: { latitude: 6.887103, longitude: 3.722375 },
		address: "Babcock University, Ilishan-Remo",
		category: "housing",
		popular: false,
	},
	{
		id: "andrews-park",
		name: "Andrews Park",
		type: "recreational",
		coordinates: { latitude: 6.887881, longitude: 3.721501 },
		address: "Babcock University, Ilishan-Remo",
		category: "park",
		popular: false,
	},
	{
		id: "banks",
		name: "Banks Area",
		type: "commercial",
		coordinates: { latitude: 6.8907987, longitude: 3.7207362 },
		address: "Babcock University, Ilishan-Remo",
		category: "finance",
		popular: true,
	},
];

async function uploadLocations() {
	try {
		console.log("Starting location upload...");

		for (const location of locations) {
			const locationRef = doc(db, "locations", location.id);
			await setDoc(locationRef, {
				...location,
				createdAt: new Date().toISOString(),
				active: true,
				searchKeywords: generateSearchKeywords(location.name),
			});
			console.log(`✓ Uploaded: ${location.name}`);
		}

		console.log("\n✅ All locations uploaded successfully!");
		process.exit(0);
	} catch (error) {
		console.error("❌ Error uploading locations:", error);
		process.exit(1);
	}
}

// Generate search keywords for better search functionality
function generateSearchKeywords(name) {
	const words = name.toLowerCase().split(" ");
	const keywords = [];

	// Add full name
	keywords.push(name.toLowerCase());

	// Add individual words
	words.forEach((word) => {
		if (word.length > 2) {
			keywords.push(word);
		}
	});

	// Add partial matches (first 3+ characters)
	words.forEach((word) => {
		for (let i = 3; i <= word.length; i++) {
			keywords.push(word.substring(0, i));
		}
	});

	return [...new Set(keywords)]; // Remove duplicates
}

// Run the upload
uploadLocations();
