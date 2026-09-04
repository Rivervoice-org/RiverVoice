import notifee, { AndroidImportance, EventType } from "react-native-notify-kit";
import { router } from "expo-router";
import { CallStatus } from "@/lib/webrtc/ferry-call";
import {
  inCallRouteParams,
  type ActiveCallMeta,
} from "@/state/active-call/context";

/**
 * The Android-only "ongoing call" notification/foreground service — what
 * keeps the call (and its WebRTC audio) actually running once the user
 * backgrounds the app, and gives them a way back in from outside the app.
 */

const CHANNEL_ID = "call";
const NOTIFICATION_ID = "active-call";

function statusBody(status: CallStatus): string {
  switch (status) {
    case CallStatus.Connecting:
      return "Calling…";
    case CallStatus.Ringing:
      return "Ringing…";
    case CallStatus.Connected:
      return "Ongoing call — tap to return";
    default:
      return "Call";
  }
}

let channelReady: Promise<void> | null = null;
function ensureChannel(): Promise<void> {
  channelReady ??= notifee
    .createChannel({
      id: CHANNEL_ID,
      name: "Ongoing call",
      // LOW: a status indicator the user glances at, not an alert — no
      // sound or heads-up popup, just visible in the shade/status bar.
      importance: AndroidImportance.LOW,
    })
    .then(() => undefined);
  return channelReady;
}

let serviceRegistered = false;
/** Must run once before the first `asForegroundService` notification. The
 * task's promise is deliberately never resolved — `endCallNotification`
 * stops the service via `notifee.stopForegroundService()` instead. */
function ensureForegroundServiceRegistered(): void {
  if (serviceRegistered) return;
  serviceRegistered = true;
  notifee.registerForegroundService(() => new Promise<void>(() => {}));
}

/**
 * Call once, e.g. from `ActiveCallProvider`'s mount effect. Sets up the
 * channel/foreground-service registration and the tap-to-return handler for
 * whenever the app's JS is already running. Returns the unsubscribe function.
 */
export function initCallNotifications(): () => void {
  ensureForegroundServiceRegistered();
  void ensureChannel();
  return notifee.onForegroundEvent(({ type, detail }) => {
    if (type !== EventType.PRESS) return;
    const data = detail.notification?.data;
    if (!data) return;
    router.push({
      pathname: "/in-call",
      params: data as Record<string, string>,
    });
  });
}

/** Shows (or updates in place — same `id`) the ongoing-call notification.
 * `showChronometer` + `timestamp` drive a native, live-ticking duration
 * once connected, so this doesn't need to be re-called every second.
 *
 * `isStale`, when given, is checked right before the notification is
 * actually displayed — the two `await`s above it (channel setup, permission
 * prompt) mean this call can still be in flight after the call it was
 * syncing for has already ended and `endCallNotification` has already run.
 * Without this check, that stale call would resurrect the notification for
 * a call that's already over, with nothing left watching to clean it up. */
export async function syncCallNotification(
  meta: ActiveCallMeta,
  status: CallStatus,
  connectedAt: number | null,
  isStale?: () => boolean,
): Promise<void> {
  await ensureChannel();
  await notifee.requestPermission();
  if (isStale?.()) return;
  const showChronometer =
    status === CallStatus.Connected && connectedAt !== null;
  // `timestamp` is declared as `number` (no `| undefined`) — omit the key
  // entirely rather than pass `timestamp: undefined`, which
  // exactOptionalPropertyTypes rejects the same way it did for
  // ActiveCallMeta's optional fields.
  const chronometerFields = showChronometer
    ? { showChronometer: true, timestamp: connectedAt }
    : { showChronometer: false };
  // A `microphone`-type foreground service requires RECORD_AUDIO to already
  // be granted at start time, or Android throws (SecurityException) rather
  // than just no-opping. `startCall`/`startTryAgent` request it via
  // getUserMedia, but that grant is still in flight the instant `status`
  // first flips to Connecting — so only ask for the foreground service once
  // audio has actually connected (`connectedAt` set), meaning the grant has
  // long since succeeded. Connecting/Ringing get a plain notification
  // instead — that window is brief and the app is still in the foreground.
  await notifee.displayNotification({
    id: NOTIFICATION_ID,
    title: meta.contactName || meta.phone,
    body: statusBody(status),
    // Round-tripped through the tap handler above to rebuild /in-call's
    // route params — `data` values must be string/object/number, so this
    // stays the plain string shape `inCallRouteParams` already returns.
    data: inCallRouteParams(meta),
    android: {
      channelId: CHANNEL_ID,
      asForegroundService: showChronometer,
      ongoing: true,
      pressAction: { id: "default" },
      ...chronometerFields,
    },
  });
}

/** Ends the foreground service and removes the notification — call once
 * `meta` clears (call ended, from any cause).
 *
 * Both calls are needed: `stopForegroundService()` only tears down the
 * foreground-service notification `syncCallNotification` shows once
 * connected — a call that ends while still Connecting/Ringing (busy, no
 * answer, credits exhausted before connecting, ...) only ever displayed a
 * plain `ongoing: true` notification, which `stopForegroundService()` never
 * touches and would otherwise be left behind indefinitely. */
export async function endCallNotification(): Promise<void> {
  await notifee.stopForegroundService();
  await notifee.cancelNotification(NOTIFICATION_ID);
}
