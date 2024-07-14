// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBN_9IhzuNBCMqtNXc_XoCb-akgVfwKhlE",
  authDomain: "kampusrides-9b463.firebaseapp.com",
  projectId: "kampusrides-9b463",
  storageBucket: "kampusrides-9b463.appspot.com",
  messagingSenderId: "557809109649",
  appId: "1:557809109649:web:6e2dfc8391dbdad7838d30",
  measurementId: "G-C0GKCTBKNZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);