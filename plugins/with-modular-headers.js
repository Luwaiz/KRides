const { withPodfile } = require('@expo/config-plugins');

const MODULAR_HEADER_PODS = [
    'GoogleUtilities',
    'RecaptchaInterop',
    'AppCheckCore',
    'AppAuth',
    'GTMAppAuth',
    'GTMSessionFetcher',
    'PromisesObjC',
    'PromisesSwift',
];

module.exports = function withModularHeaders(config) {
    return withPodfile(config, (config) => {
        let contents = config.modResults.contents;

        const missingPods = MODULAR_HEADER_PODS.filter(
            (pod) => !contents.includes(`pod '${pod}', :modular_headers => true`)
        );
        if (missingPods.length > 0) {
            const targetMatch = contents.match(/^target\s+['"][^'"]+['"]\s+do\b/m);
            if (!targetMatch) {
                throw new Error('Could not find the app target in the generated Podfile.');
            }

            const podLines = missingPods
                .map((pod) => `  pod '${pod}', :modular_headers => true`)
                .join('\n');

            contents = contents.replace(
                targetMatch[0],
                `${targetMatch[0]}\n${podLines}`
            );
        }

        const postInstallHook = `    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_configuration|
        deployment_target = build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if deployment_target && Gem::Version.new(deployment_target) < Gem::Version.new('15.0')
          build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.0'
        end

        if target.name == 'fmt'
          definitions = Array(build_configuration.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] || ['$(inherited)'])
          definitions << 'FMT_USE_CONSTEVAL=0' unless definitions.include?('FMT_USE_CONSTEVAL=0')
          build_configuration.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = definitions
        end
      end
    end
`;

        if (!contents.includes("definitions << 'FMT_USE_CONSTEVAL=0'")) {
            const postInstallMatch = contents.match(/post_install\s+do\s+\|installer\|\s*\r?\n/);
            if (!postInstallMatch) {
                throw new Error('Could not find the post_install hook in the generated Podfile.');
            }

            contents = contents.replace(postInstallMatch[0], `${postInstallMatch[0]}${postInstallHook}`);
        }

        config.modResults.contents = contents;
        return config;
    });
};
