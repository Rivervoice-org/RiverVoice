import { View, Pressable, type TextInputProps } from "react-native";
import { Search, X } from "lucide-react-native";
import { Input } from "@/components/ui/input";

/**
 * A pill-shaped, borderless field — the system-search affordance (iOS/Notion),
 * not a bordered text input pretending to be one. Icon and clear button sit in
 * their own views since NativeWind can't position lucide's Svg directly.
 */
export function SearchInput({
  value,
  onChangeText,
  placeholder = "Search",
  ...props
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
} & Omit<TextInputProps, "value" | "onChangeText" | "placeholder">) {
  return (
    <View className="relative">
      <View className="pointer-events-none absolute top-0 bottom-0 left-3.5 z-10 justify-center">
        <Search size={16} strokeWidth={1.75} color="#8f8c87" />
      </View>
      <Input
        className="h-10 rounded-full border-0 bg-secondary pl-10 pr-9"
        placeholder={placeholder}
        placeholderTextColor="#8f8c87"
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        {...props}
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => onChangeText("")}
          hitSlop={8}
          className="absolute top-0 bottom-0 right-3 z-10 justify-center"
        >
          <View className="h-4 w-4 items-center justify-center rounded-full bg-muted-foreground/25">
            <X size={10} strokeWidth={2.5} color="#5c5850" />
          </View>
        </Pressable>
      )}
    </View>
  );
}
