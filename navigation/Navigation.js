import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { NavigationContainer } from '@react-navigation/native'
import OnBoarding from '../screens/OnBoarding'
import AuthScreen from '../screens/AuthScreen'

const Stack = createNativeStackNavigator()
const Navigation = () => {
  return (
    <NavigationContainer>
        <Stack.Navigator screenOptions={{headerShown:false}}>
            <Stack.Screen component={OnBoarding} name='OnBoarding'/>
            <Stack.Screen component={AuthScreen} name='AuthScreen'/>

        </Stack.Navigator>
    </NavigationContainer>
  )
}

export default Navigation

const styles = StyleSheet.create({})