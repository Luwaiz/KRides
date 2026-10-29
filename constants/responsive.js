import { Dimensions, PixelRatio } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

// wp/hp/fs/sp/br/ms scale linearly off BASE_WIDTH/BASE_HEIGHT, which is correct for
// phones (~320-430pt wide) but balloons badly on tablets (768-1366pt) — a 24px font
// would render at ~65px on a 1024pt iPad, a 48px button at ~131px. Capping the
// dimension used for the ratio at the largest phone size means a tablet scales
// exactly like a large phone instead of growing further, so nothing oversizes.
// On phones (SCREEN_WIDTH below the breakpoint) this is a no-op — SCALE_WIDTH/
// SCALE_HEIGHT just equal SCREEN_WIDTH/SCREEN_HEIGHT as before.
const TABLET_BREAKPOINT = 700;
const MAX_SCALE_WIDTH = 430;
const MAX_SCALE_HEIGHT = 926;

export const isTablet = SCREEN_WIDTH >= TABLET_BREAKPOINT;
const SCALE_WIDTH = isTablet ? MAX_SCALE_WIDTH : SCREEN_WIDTH;
const SCALE_HEIGHT = isTablet ? MAX_SCALE_HEIGHT : SCREEN_HEIGHT;

export const wp = (size) => {
	return (SCALE_WIDTH / BASE_WIDTH) * size;
};

export const hp = (size) => {
	return (SCALE_HEIGHT / BASE_HEIGHT) * size;
};

export const fs = (size) => {
	const scale = SCALE_WIDTH / BASE_WIDTH;
	const newSize = size * scale;
	return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

export const sp = (size) => {
	return (SCALE_WIDTH / BASE_WIDTH) * size;
};

export const br = (size) => {
	return (SCALE_WIDTH / BASE_WIDTH) * size;
};

export const ms = (size, factor = 0.5) => {
	const scale = SCALE_WIDTH / BASE_WIDTH;
	return size + (scale - 1) * size * factor;
};

export const isSmallDevice = () => SCREEN_WIDTH < 360;

export const isLargeDevice = () => SCREEN_WIDTH > 414;

// Standard cap for form/content width on tablets, so a sheet or card doesn't
// stretch edge-to-edge across a 1024pt+ screen. Always wider than a phone
// screen, so using it unconditionally is a no-op on phones.
export const maxContentWidth = 480;

export const screen = {
	width: SCREEN_WIDTH,
	height: SCREEN_HEIGHT,
};
