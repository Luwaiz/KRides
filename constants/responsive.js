import { Dimensions, PixelRatio } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

export const wp = (size) => {
	return (SCREEN_WIDTH / BASE_WIDTH) * size;
};

export const hp = (size) => {
	return (SCREEN_HEIGHT / BASE_HEIGHT) * size;
};

export const fs = (size) => {
	const scale = SCREEN_WIDTH / BASE_WIDTH;
	const newSize = size * scale;
	return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

export const sp = (size) => {
	return (SCREEN_WIDTH / BASE_WIDTH) * size;
};

export const br = (size) => {
	return (SCREEN_WIDTH / BASE_WIDTH) * size;
};

export const ms = (size, factor = 0.5) => {
	const scale = SCREEN_WIDTH / BASE_WIDTH;
	return size + (scale - 1) * size * factor;
};

export const isSmallDevice = () => SCREEN_WIDTH < 360;

export const isLargeDevice = () => SCREEN_WIDTH > 414;

export const screen = {
	width: SCREEN_WIDTH,
	height: SCREEN_HEIGHT,
};
