import { create } from "zustand";

export const useBottomTabStore = create((set) => ({
	passengerPage: false,
	riderPage: false,
	confirmPage: false,
	AcceptRidePage: false,
	PassengerPage: () => 
		set((state) => ({ passengerPage: !state.passengerPage })),
	setRiderPage: () => 
		set((state) => ({ riderPage: !state.riderPage })),
	setConfirmPage: () => 
		set((state) => ({ confirmPage: !state.confirmPage })),
	setAcceptRidePage: () =>
		set((state) => ({ AcceptRidePage: !state.AcceptRidePage })),
	setDriverHome: () => set({AcceptRidePage: false }),
    setHomePage: () => set({ passengerPage: false , riderPage: false, confirmPage: false})

}));

