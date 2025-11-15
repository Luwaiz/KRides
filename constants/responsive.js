import { Dimensions, PixelRatio } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Base dimensions (iPhone 11 Pro / standard mobile)
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

/**
 * Responsive width based on screen width
 * @param {number} size - Size in pixels from design
 * @returns {number} Scaled size
 */
export const wp = (size) => {
	return (SCREEN_WIDTH / BASE_WIDTH) * size;
};

/**
 * Responsive height based on screen height
 * @param {number} size - Size in pixels from design
 * @returns {number} Scaled size
 */
export const hp = (size) => {
	return (SCREEN_HEIGHT / BASE_HEIGHT) * size;
};

/**
 * Responsive font size
 * @param {number} size - Font size in pixels
 * @returns {number} Scaled font size
 */
export const fs = (size) => {
	const scale = SCREEN_WIDTH / BASE_WIDTH;
	const newSize = size * scale;
	return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

/**
 * Responsive spacing (for padding, margin, gaps)
 * @param {number} size - Spacing in pixels
 * @returns {number} Scaled spacing
 */
export const sp = (size) => {
	return (SCREEN_WIDTH / BASE_WIDTH) * size;
};

/**
 * Responsive border radius
 * @param {number} size - Border radius in pixels
 * @returns {number} Scaled border radius
 */
export const br = (size) => {
	return (SCREEN_WIDTH / BASE_WIDTH) * size;
};

/**
 * Moderately scale (less aggressive scaling)
 * Good for icon sizes, button heights
 * @param {number} size - Size in pixels
 * @param {number} factor - Scaling factor (default 0.5)
 * @returns {number} Scaled size
 */
export const ms = (size, factor = 0.5) => {
	const scale = SCREEN_WIDTH / BASE_WIDTH;
	return size + (scale - 1) * size * factor;
};

/**
 * Check if device is small (width < 360px)
 */
export const isSmallDevice = () => SCREEN_WIDTH < 360;

/**
 * Check if device is large (width > 414px)
 */
export const isLargeDevice = () => SCREEN_WIDTH > 414;

/**
 * Get screen dimensions
 */
export const screen = {
	width: SCREEN_WIDTH,
	height: SCREEN_HEIGHT,
};
