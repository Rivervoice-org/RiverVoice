import { Bluetooth, Ear, Headphones, Volume2 } from "lucide-react-native";
import { AudioDevice } from "@/lib/webrtc/ferry-call";

type SelectableAudioDevice = Exclude<AudioDevice, AudioDevice.None>;

export const AUDIO_ROUTE_LABELS: Record<SelectableAudioDevice, string> = {
  [AudioDevice.Earpiece]: "Earpiece",
  [AudioDevice.SpeakerPhone]: "Speaker",
  [AudioDevice.WiredHeadset]: "Headset",
  [AudioDevice.Bluetooth]: "Bluetooth",
};

export const AUDIO_ROUTE_ICONS: Record<SelectableAudioDevice, typeof Volume2> =
  {
    [AudioDevice.Earpiece]: Ear,
    [AudioDevice.SpeakerPhone]: Volume2,
    [AudioDevice.WiredHeadset]: Headphones,
    [AudioDevice.Bluetooth]: Bluetooth,
  };

// Fixed display order in the picker, independent of whatever order the
// native device list reports its entries in.
export const AUDIO_ROUTE_ORDER: SelectableAudioDevice[] = [
  AudioDevice.Earpiece,
  AudioDevice.SpeakerPhone,
  AudioDevice.WiredHeadset,
  AudioDevice.Bluetooth,
];
