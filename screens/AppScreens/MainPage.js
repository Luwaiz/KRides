import { StyleSheet, Text, View } from "react-native";
import React from "react";
import BottomSheet from "@gorhom/bottom-sheet";
import { Feather } from '@expo/vector-icons';
import { colors } from "../../constants/styling";
import ActiveButton from "../../components/buttons/ActiveButton";

const MainPage = () => {
	return (
		<View style={styles.container}>
			<BottomSheet
				snapPoints={["46%"]}
				backgroundStyle={{ borderRadius: 30, }}
				handleComponent={null}
			>
        <View style={styles.sheetCont}>
          <View style={styles.topText}>
            <Text style={styles.greet}>Hello, <Text style={{color:colors.primaryBlue}}>Tobi</Text></Text>
            <Text style={styles.where}>Where are you going?</Text>
          </View>
          <View style={styles.locations}>
            <View style={styles.pointers}></View>
            <View style={styles.destinations}>
              <View style={styles.destination}>
                <Text style={styles.destinationText}>Choose Pickup Location</Text>
              </View>
              <View style={styles.destination}>
                <Text style={styles.destinationText}>Choose Destination</Text>
              </View>
            </View>
          </View>
          <View style={styles.dateCont}>
          <Feather name="calendar" size={24} color={colors.primaryBlue} />
            <Text style={styles.date}>14/7/2023</Text>
          </View>
          <View style={styles.button}>
          <ActiveButton title={"Continue"}/>
          </View>
        </View>
      </BottomSheet>
		</View>
	);
};

export default MainPage;

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: "center",
		backgroundColor: colors.lightGrey2,
	},
  sheetCont:{
    flex: 1,
    paddingBottom:16,
    paddingTop:30,
    paddingHorizontal:16,

  },
  topText:{
    marginBottom:10
  },
  greet:{
    fontSize:16,
    fontWeight:"regular",
    color:"black",
    marginBottom:4
  },
  where:{
    fontSize:24,
    fontWeight:"bold",
    color:"black",
  },
  locations:{
    alignSelf:"center",
    backgroundColor:colors.lightGrey2,
    width:"100%",
    height:160,
    borderRadius:16,
    flexDirection:"row",
    gap:16,
    padding:16,
    justifyContent:"center",
  },
  pointers:{
    width:34,
    height:"100%",
    backgroundColor:colors.primaryBlue,
  },
  destinations:{
    minWidth:270,
    height:"100%",
    justifyContent:"space-between"
  },
  destination:{
    width:"100%",
    height:54,
    backgroundColor:colors.secondary,
    borderRadius:8,
    padding:16
  },
  destinationText:{
    fontSize:16,
    fontWeight:"regular",
    color:"black"
  },
  dateCont:{
    flexDirection:"row",
    marginVertical:"auto",
    alignItems:"center"
  },
  date:{
    fontSize:16,
    fontWeight:"regular",
    color:"black"
  },
  button:{
    marginTop:'auto'
  }
});
