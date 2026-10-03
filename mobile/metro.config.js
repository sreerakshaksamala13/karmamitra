const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Metro only needs runtime files; excluding these folders keeps its native
// filesystem watcher below macOS limits when Watchman is unavailable.
config.resolver.blockList = [
  /(?:^|[/\\])(?:__tests__|__mocks__|tests?|docs?|examples?|fixtures|android|ios|windows|macos|visionos|\.github)(?:[/\\]|$)/,
];

module.exports = config;
