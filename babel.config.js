module.exports = function (api) {
	api.cache(true);
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
			// Strip console.log in production builds; keep error/warn for crash diagnostics
			...(isProduction ? [["transform-remove-console", { exclude: ["error", "warn"] }]] : []),
		],
	};
};
