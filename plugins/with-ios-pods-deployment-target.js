const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const MARKER = 'ZENITH_FORCE_IOS_PODS_DEPLOYMENT_TARGET';

function createDeploymentTargetSnippet(deploymentTarget) {
  return `
  # ${MARKER}
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${deploymentTarget}'
    end
  end
`;
}

function updatePodfile(contents, deploymentTarget) {
  const snippet = createDeploymentTargetSnippet(deploymentTarget);

  if (contents.includes(MARKER)) {
    return contents.replace(
      /config\.build_settings\['IPHONEOS_DEPLOYMENT_TARGET'\] = '[^']+'/g,
      `config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${deploymentTarget}'`
    );
  }

  const reactNativePostInstallCall = /(react_native_post_install\([\s\S]*?\n\s*\))/;
  if (reactNativePostInstallCall.test(contents)) {
    return contents.replace(reactNativePostInstallCall, `$1${snippet}`);
  }

  const postInstallBlock = /post_install do \|installer\|\n/;
  if (postInstallBlock.test(contents)) {
    return contents.replace(postInstallBlock, `$&${snippet}`);
  }

  return `${contents.trimEnd()}\n\npost_install do |installer|${snippet}end\n`;
}

module.exports = function withIosPodsDeploymentTarget(config, props = {}) {
  // Expo SDK 56+ requires an iOS deployment target of at least 16.4.
  const deploymentTarget = props.deploymentTarget || '16.4';

  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');

      if (fs.existsSync(podfilePath)) {
        const contents = fs.readFileSync(podfilePath, 'utf8');
        const updatedContents = updatePodfile(contents, deploymentTarget);

        if (contents !== updatedContents) {
          fs.writeFileSync(podfilePath, updatedContents);
        }
      }

      return config;
    },
  ]);
};
