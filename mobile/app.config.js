const IS_DEV = process.env.APP_VARIANT === "development";

const APP_ID = IS_DEV ? "com.rivervoice.app.dev" : "com.rivervoice.app";

module.exports = {
  expo: {
    name: "Rivervoice",
    slug: "rivervoice-mobile",
    scheme: "rivervoice",
    version: "0.2.1-dev.1",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    plugins: [
      "expo-router",
      "expo-dev-client",
      [
        "@config-plugins/react-native-webrtc",
        {
          microphonePermission:
            "Allow $(PRODUCT_NAME) to access your microphone to place calls.",
        },
      ],
      "expo-secure-store",
      "expo-audio",
      "@react-native-google-signin/google-signin",
      [
        "expo-splash-screen",
        {
          image: "./assets/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#E6F4FE",
        },
      ],
    ],
    ios: {
      supportsTablet: true,
      bitcode: false,
      bundleIdentifier: APP_ID,
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#FFFFFF",
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: false,
      permissions: [
        "android.permission.ACCESS_NETWORK_STATE",
        "android.permission.CAMERA",
        "android.permission.INTERNET",
        "android.permission.MODIFY_AUDIO_SETTINGS",
        "android.permission.RECORD_AUDIO",
        "android.permission.SYSTEM_ALERT_WINDOW",
        "android.permission.WAKE_LOCK",
        "android.permission.BLUETOOTH",
        "android.permission.BLUETOOTH_CONNECT",
      ],
      package: APP_ID,
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro",
    },
    extra: {
      router: {},
      eas: {
        projectId: "11b6f157-6a99-4132-9e04-428255a9b65f",
      },
    },
  },
};
