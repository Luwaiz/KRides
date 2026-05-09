import ViewMap from "../assets/svg/MapViewman";
import ManMap from "../assets/svg/manMap";
import Keke from "../assets/svg/KekeDriver";
import { Dimensions } from "react-native";

const { width, height } = Dimensions.get("window");
const imageHeight = height * 0.65;

export const OnBoard = [
	{
		id: 1,
		title: "Set your Pickup Location",
		subTitle:
			"Enter your address or click on the map to select your pickup location.",
		image: <ViewMap width={width} height={imageHeight} preserveAspectRatio="xMidYMid slice" />,
	},
	{
		id: 2,
		title: "Choose your destination",
		subTitle: "Choosing your destination enables the rider to take you safely.",
		image: <ManMap width={width} height={imageHeight} preserveAspectRatio="xMidYMid slice" />,
	},
	{
		id: 3,
		title: "Find the perfect rider",
		subTitle:
			"Select the perfect rider you deem fit to ride you to your preferred location.",
		image: <Keke width={width} height={imageHeight} preserveAspectRatio="xMidYMid slice" />,
	},
];
