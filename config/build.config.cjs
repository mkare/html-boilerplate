const PROFILES = Object.freeze({
  development: {
    mode: 'development',
    minimize: false,
    devtool: 'eval-cheap-module-source-map',
    htmlMinify: false,
    htmlPretty: true,
    preview: false,
  },
  'catalog-preview': {
    mode: 'production',
    minimize: true,
    devtool: false,
    htmlMinify: true,
    htmlPretty: false,
    preview: true,
  },
  'customer-production': {
    mode: 'production',
    minimize: true,
    devtool: false,
    htmlMinify: true,
    htmlPretty: false,
    preview: false,
  },
  starter: {
    mode: 'production',
    minimize: true,
    devtool: false,
    htmlMinify: true,
    htmlPretty: false,
    preview: false,
  },
  'release-html': {
    mode: 'production',
    minimize: true,
    devtool: false,
    htmlMinify: false,
    htmlPretty: true,
    preview: false,
  },
});

function getBuildConfig(env = {}, argv = {}, processEnv = process.env) {
  const profileName = env.profile || processEnv.BUILD_PROFILE ||
    (argv.mode === 'development' ? 'development' : 'customer-production');
  const profile = PROFILES[profileName];

  if (!profile) {
    throw new Error(`Unknown BUILD_PROFILE "${profileName}". Choose: ${Object.keys(PROFILES).join(', ')}.`);
  }

  const buildNowInput = env.buildNow || processEnv.BUILD_NOW || new Date().toISOString();
  const buildNowDate = new Date(buildNowInput);
  if (Number.isNaN(buildNowDate.getTime())) {
    throw new Error(`BUILD_NOW must be a valid ISO-8601 date/time; received "${buildNowInput}".`);
  }

  const buildNow = buildNowDate.toISOString();

  return Object.freeze({ name: profileName, ...profile, buildNow });
}

module.exports = { PROFILES, getBuildConfig };
