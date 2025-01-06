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

export const useUserDetails= create ((set)=>({
	firstName:"",
	lastName:"",
	phone:"",
    email:"",
    password:"",
	UserId:"",
	accessToken:"",
	setAccessToken: (accessToken) => set({ accessToken}),
	setFirstName: (firstName) => set({ firstName }),
    setLastName: (lastName) => set({ lastName}),
    setPhone: (phone) => set({phone }),
    setEmail: (email) => set({email }),
    setPassword: (password) => set({password }),
	setUserId: (UserId) => set({UserId }),
}))
