module.exports = {
  testMatch: ["**/test/**/*.test.js"],
  testPathIgnorePatterns: ["/node_modules/", "/test-archive/"],
  moduleNameMapper: {
    "^sanitize-html$": "<rootDir>/test/__mocks__/sanitize-html.js"
  },
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  detectOpenHandles: true
};
