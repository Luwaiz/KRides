import { io } from "socket.io-client";

// Use your machine's LAN IP if you're testing on a real device
const socket = io("http://192.168.29.60:3001", {
	transports: ["websocket"],
	autoConnect: false,
	reconnection: true,
	reconnectionAttempts: Infinity, // Keep trying forever
	reconnectionDelay: 1000, // 1s delay between attempts
	reconnectionDelayMax: 5000, // Max 5s delay
	timeout: 10000, // Connection timeout
});

export default socket;
