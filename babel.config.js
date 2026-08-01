module.exports = function (api) {
	// api.env() configures its own caching internally (keyed on the env
	// name) — calling api.cache(true) first locks the cache to "forever"
	// mode, and api.env() then tries to reconfigure it, which throws
	// "Caching has already been configured with .never or .forever()".
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
