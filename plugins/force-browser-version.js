const {
  withAppBuildGradle,
  withProjectBuildGradle,
} = require("expo/config-plugins");

/**
 * Fixes transitive dependency incompatibilities on EAS builds:
 * 1. Forces androidx.browser:browser to 1.8.0 (1.9.0 requires compileSdk 36 + AGP 8.9.1)
 * 2. Adds -Xskip-metadata-version-check so Kotlin 2.0.21 compiler can read
 *    AAR libraries pre-compiled with Kotlin 2.2 metadata
 */
module.exports = function forceDependencyVersions(config) {
  // App-level: force dependency versions
  config = withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;

    const resolutionStrategy = `
configurations.all {
    resolutionStrategy {
        force 'androidx.browser:browser:1.8.0'
    }
}
`;

    if (!contents.includes("force 'androidx.browser:browser")) {
      config.modResults.contents = contents + "\n" + resolutionStrategy;
    }

    return config;
  });

  // Project-level: skip Kotlin metadata version check for all subprojects
  config = withProjectBuildGradle(config, (config) => {
    const contents = config.modResults.contents;

    const kotlinFix = `
subprojects {
    tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
        compilerOptions {
            freeCompilerArgs.add("-Xskip-metadata-version-check")
        }
    }
}
`;

    if (!contents.includes("-Xskip-metadata-version-check")) {
      config.modResults.contents = contents + "\n" + kotlinFix;
    }

    return config;
  });

  return config;
};
