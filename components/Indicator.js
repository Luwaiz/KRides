import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React from 'react'
import { colors } from '../constants/styling'

const Indicator = ({item,currentIndex,setCurrentIndex}) => {
    const currentSlide = (index)=>{
        setCurrentIndex(index)
    }
    // Indicator for onBoarding Page
  return (
    <View style={styles.container}>
    {item.map((_,index)=>(
        <TouchableOpacity key={index}>
        <View style={[styles.indicate,currentIndex === index && styles.currentIndicator]}/>
        </TouchableOpacity>
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
        bottom:16
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