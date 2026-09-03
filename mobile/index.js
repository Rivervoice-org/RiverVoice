import notifee, { EventType } from "react-native-notify-kit";
import { router } from "expo-router";

// Fallback for a tap on the ongoing-call notification when this app's JS
// was suspended (OEM battery management can do this despite the foreground
// service) — must be registered before expo-router's entry runs. See
// lib/call-notification.ts's initCallNotifications for the normal case.
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type !== EventType.PRESS) return;
  const data = detail.notification?.data;
  if (!data) return;
  router.push({ pathname: "/in-call", params: data });
});

require("expo-router/entry");
