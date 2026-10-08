import type { ConfigContext, ExpoConfig } from "expo/config";

// One config for every environment. EXPO_PUBLIC_APP_ENV is set per EAS build
// profile (eas.json) and decides which backend deployment the app talks to
// (see src/config/env.ts). Nothing secret belongs in this file.

const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV ?? "development";
const IS_PROD = APP_ENV === "production";

// Same package as the old WebView app in ../android, so a Play release of this
// app (signed with the same upload key) ships as an update to existing installs.
const ANDROID_PACKAGE = "com.riff.app";
// Placeholder until an Apple developer account / bundle id is registered.
const IOS_BUNDLE_ID = process.env.IOS_BUNDLE_ID ?? "com.riff.app";

// Website hosts whose links should open the app (paths mirror the web routes).
const LINK_HOSTS = ["riff.soundrig.io", "riff-app.onrender.com"];

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_PROD ? "Riff" : `Riff (${APP_ENV})`,
  slug: "riff",
  owner: process.env.EXPO_OWNER || undefined,
  version: "2.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "riff",
  userInterfaceStyle: "dark",
  backgroundColor: "#0a0a0f",
  ios: {
    bundleIdentifier: IOS_BUNDLE_ID,
    buildNumber: "1",
    supportsTablet: false,
    associatedDomains: LINK_HOSTS.map((h) => `applinks:${h}`),
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: ANDROID_PACKAGE,
    // Must stay above the WebView app's versionCode (1).
    versionCode: 2,
    adaptiveIcon: {
      backgroundColor: "#0a0a0f",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
    softwareKeyboardLayoutMode: "resize",
    // Only what the app actually uses; image-picker would otherwise add audio.
    blockedPermissions: ["android.permission.RECORD_AUDIO", "android.permission.SYSTEM_ALERT_WINDOW"],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: LINK_HOSTS.map((host) => ({ scheme: "https", host })),
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: { output: "static", favicon: "./assets/images/favicon.png" },
  plugins: [
    "expo-router",
    "expo-font",
    ["expo-secure-store", { configureAndroidBackup: true }],
    [
      "expo-image-picker",
      {
        photosPermission: "Riff needs access to your photos so you can attach images to assignments, cards and your brand kit.",
        cameraPermission: "Riff needs the camera so you can take a photo to attach to assignments, cards and your brand kit.",
        microphonePermission: false,
      },
    ],
    [
      "expo-splash-screen",
      {
        backgroundColor: "#0a0a0f",
        image: "./assets/images/splash-icon.png",
        imageWidth: 140,
      },
    ],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: {
    appEnv: APP_ENV,
    eas: process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : undefined,
  },
});
