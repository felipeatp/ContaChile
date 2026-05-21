/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // pnpm stores packages under node_modules/.pnpm/<pkg@ver>/node_modules/<pkg>
  // The default jest-expo pattern doesn't account for this nested path, so react-native's
  // own setup.js ends up untransformed. Adding ".pnpm" to the negative lookahead list
  // prevents the outer node_modules/.pnpm/ segment from matching, letting the inner
  // node_modules/<pkg> segment match correctly.
  transformIgnorePatterns: [
    'node_modules/(?!(.pnpm|react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|better-auth|@better-auth|@react-native-google-signin))',
  ],
  moduleNameMapper: {
    '^expo-secure-store$': '<rootDir>/__mocks__/expo-secure-store.js',
  },
}
