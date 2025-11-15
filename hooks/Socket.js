import { io } from "socket.io-client";

// Use your machine's LAN IP if you're testing on a real device
// If websocket transport is blocked on your network, allow polling as a fallback.
const SOCKET_HOST = "http://192.168.193.60:3001";

const socket = io(SOCKET_HOST, {
	// try polling first, then upgrade to websocket when possible
	transports: ["polling", "websocket"],
	autoConnect: false,
	reconnection: true,
	reconnectionAttempts: Infinity,
	reconnectionDelay: 1000,
	reconnectionDelayMax: 5000,
	// increase connection timeout to allow slow networks
	timeout: 20000,
});

socket.onAny((event, ...args) => {
	console.log("📡 Socket Event:", event, args);
});

socket.io.on("reconnect_attempt", (attempt) => {
	console.log(`🔁 Socket reconnect attempt #${attempt}`);
});

socket.on("connect_error", (err) => {
	console.warn("❌ Connection error:", err && err.message ? err.message : err);
});

socket.on("connect", () => {
	console.log(`✅ Socket connected: ${socket.id}`);
});

export default socket;
