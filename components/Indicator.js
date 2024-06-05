import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { colors } from '../constants/styling'

const Indicator = ({item}) => {
  return (
    <View style={styles.container}>
    {item.map((_,index)=>(
        <View key={index} style={styles.indicate}/>
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
    indicate:{
        width:20,
        height:20,
        borderRadius:10,
        backgroundColor:colors.primaryBlue,
        borderWidth:2,
        borderColor:"#fff"
    }
})