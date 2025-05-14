import { Dimensions } from "react-native"
import ViewMap from  "../assets/svg/MapViewman"
import ManMap from  "../assets/svg/manMap"
import Keke from  "../assets/svg/KekeDriver"

const {width,height}= Dimensions.get ("window")


export const OnBoard=[
    {
        id: 1,
        title:"Set your Pickup Location",
        subTitle:"Enter your address or click on the map to select your pickup location.",
        image: <ViewMap/>
    },
    {
        id: 2,
        title:"Choose your destination",
        subTitle:"Choosing your destination enables the rider to take you safely.",
        image: <ManMap width={width} height={height-320}/>

    },
    {
        id: 3,
        title:"Find the perfect rider",
        subTitle:"Select the perfect rider you deem fit to ride you to your preferred location.",
        image: <Keke />

    }
]