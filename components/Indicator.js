import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { colors } from '../constants/styling'

const Indicator = ({item,currentIndex}) => {
    // Indicator for onBoarding Page
  return (
    <View style={styles.container}>
    {item.map((_,index)=>(
        <View key={index} style={[styles.indicate,currentIndex === index && styles.currentIndicator]}/>
    ))}
    </View>
  )
}

export default Indicator

const styles = StyleSheet.create({
    container:{
        alignItems:"center",
        flexDirection:"row",
        justifyContent:"center",
        paddingVertical:10,
        position:"absolute",
        bottom:10
    },
    currentIndicator:{
        backgroundColor:colors.primaryBlue,
    },
    indicate:{
        backgroundColor:colors.secondary,
        borderWidth:0.5,
        borderColor:"black",
        borderRadius:20,
        width:16,
        height:16,
        marginHorizontal:3
    }
})