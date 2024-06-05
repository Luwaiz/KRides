import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { colors } from '../constants/styling'

const Indicator = ({item,currentIndex}) => {
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
        width:18,
        height:18,
        marginHorizontal:3
    }
})