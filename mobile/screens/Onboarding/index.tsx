import { useCallback, useRef, useState } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Rise } from "@/components/ui/rise";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { markOnboardingSeen } from "@/lib/onboarding";
import {
  AgentsIllustration,
  CallsIllustration,
  TranslateIllustration,
} from "./illustrations";

const SLIDES = [
  {
    key: "translate",
    title: "AI translation,\non every call",
    body: "An AI agent joins the line and translates in real time, in any language, so nothing gets lost.",
    Illustration: TranslateIllustration,
  },
  {
    key: "agents",
    title: "Pick an agent\nfor the job",
    body: "Choose a ready-made agent or build your own, then use it on any call you place.",
    Illustration: AgentsIllustration,
  },
  {
    key: "calls",
    title: "Every call,\nright where you left it",
    body: "Recordings, transcripts, and credits — all tracked automatically as you call.",
    Illustration: CallsIllustration,
  },
] as const;

function finish() {
  markOnboardingSeen();
  router.replace("/(tabs)");
}

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const isLast = index === SLIDES.length - 1;

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / width);
      setIndex(next);
    },
    [width],
  );

  const goNext = useCallback(() => {
    if (isLast) {
      finish();
      return;
    }
    scrollRef.current?.scrollTo({ x: width * (index + 1), animated: true });
  }, [isLast, index, width]);

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="flex-row justify-end px-5 pt-2">
        <Pressable onPress={finish} hitSlop={8} className="active:opacity-70">
          <Text variant="muted" className="text-[13px] font-medium">
            Skip
          </Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        className="flex-1"
      >
        {SLIDES.map(({ key, title, body, Illustration }) => (
          <View key={key} style={{ width }} className="flex-1 px-8">
            <View className="flex-1 items-center justify-center">
              <Illustration />
              <Rise>
                <Text className="mt-6 text-center text-[26px] font-semibold leading-tight tracking-[-0.02em]">
                  {title}
                </Text>
              </Rise>
              <Rise delay={80}>
                <Text
                  variant="muted"
                  className="mt-4 max-w-xs text-center text-sm leading-6"
                >
                  {body}
                </Text>
              </Rise>
            </View>
          </View>
        ))}
      </ScrollView>

      <View className="gap-6 px-6 pb-10">
        <View className="flex-row items-center justify-center gap-2">
          {SLIDES.map((slide, i) => (
            <View
              key={slide.key}
              className={cn(
                "h-1.5 rounded-full bg-foreground",
                i === index ? "w-5 opacity-100" : "w-1.5 opacity-25",
              )}
            />
          ))}
        </View>

        <Button size="lg" onPress={goNext}>
          {isLast ? "Get started" : "Next"}
        </Button>
      </View>
    </SafeAreaView>
  );
}
