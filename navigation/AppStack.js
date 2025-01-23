import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import MainPage from '../screens/AppScreens/MainPage'
import PickDestination from '../screens/AppScreens/Route'
import About from '../screens/AppScreens/About'
import Support from '../screens/AppScreens/Support'
import History from '../screens/AppScreens/History'
import ProfilePage from '../screens/AppScreens/ProfilePage'
import AvailableRiders from '../components/AvailableRiders'
import Passenger from '../components/Passenger'
import Promo from '../screens/AppScreens/Promo'
import Ratings from '../screens/AppScreens/Rating'
import HomePageNav from './HomePageNav'

const Stack = createNativeStackNavigator()
const AppStack = () => {
  return (

    <Stack.Navigator screenOptions={{headerShown:false}}>
      {/* <Stack.Screen name="HomePageNav" component={HomePageNav} /> */}
      <Stack.Screen name="Home" component={MainPage} />
      <Stack.Screen name="Support" component={Support}/>
      <Stack.Screen name="About" component={About}/>
      <Stack.Screen name="History" component={History}/>
      <Stack.Screen name="Profile" component={ProfilePage}/>
      <Stack.Screen name="Destinations" component={PickDestination} />
      <Stack.Screen name="Passenger" component={Passenger}  />
      <Stack.Screen name="Riders" component={AvailableRiders}  />
      <Stack.Screen name="Promo" component={Promo}  />
      <Stack.Screen name="Rating" component={Ratings}  />

    </Stack.Navigator>
  )
}

export default AppStack
