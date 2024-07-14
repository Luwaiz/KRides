import { create } from "zustand";

export const useBottomTabStore = create((set) => ({
	passengerPage: false,
	riderPage: false,
	confirmPage: false,
	PassengerPage: () => 
		set((state) => ({ passengerPage: !state.passengerPage })),
	setRiderPage: () => 
		set((state) => ({ riderPage: !state.riderPage })),
	setConfirmPage: () => 
		set((state) => ({ confirmPage: !state.confirmPage })),
    setHomePage: () => set({ passengerPage: false , riderPage: false, confirmPage: false})
}));

