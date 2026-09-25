module.exports = function (api) {
	const isProduction = api.env('production');
	return {
		presets: ["babel-preset-expo"],
		plugins: [
			"react-native-reanimated/plugin",
			"react-native-paper/babel",
			[
				"module:react-native-dotenv",
				{
					moduleName: "@env",
					path: ".env",
				},
			],
			...(isProduction ? [["transform-remove-console", { exclude: ["error", "warn"] }]] : []),
		],
	};
};
