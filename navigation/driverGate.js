// Decides which screen a signed-in driver gets. Kept as one pure function so the rule is in a
// single place and can be tested: the dashboard is reachable only when the driver profile
// belongs to the signed-in account AND its bank details are verified.
//
//   "loading"   - profile not loaded yet (or it's another account's): don't guess
//   "bank"      - profile loaded, bank details not verified: only the bank screen
//   "dashboard" - profile loaded and bank details verified
export function getDriverScreen(user, driverUid, bankDetailsVerified) {
	if (!user?.uid || driverUid !== user.uid) return "loading";
	return bankDetailsVerified === true ? "dashboard" : "bank";
}
