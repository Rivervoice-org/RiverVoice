import { useState } from "react";
import {
  View,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Link } from "expo-router";
import { Waves } from "lucide-react-native";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/theme";

export default function SignUpScreen() {
  const colors = useThemeColors();
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    const digits = phone.replace(/\D/g, "");
    if (!name.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    if (digits.length < 10) {
      setError("Enter a valid phone number.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await signUp({ name: name.trim(), phone: digits });
      // The (auth) layout redirects into the app once the session lands.
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 px-6 py-12">
          {/* Logo */}
          <View className="flex-row items-center gap-2">
            <View className="h-6 w-6 items-center justify-center rounded-md border border-border">
              <Waves size={14} strokeWidth={2} color={colors.ink} />
            </View>
            <Text className="text-sm font-medium">Rivervoice</Text>
          </View>

          {/* Form */}
          <View className="mt-auto mb-auto">
            <Text className="text-[26px] font-semibold leading-tight tracking-[-0.02em]">
              Create an account
            </Text>
            <Text variant="muted" className="mt-2 text-sm">
              Your first agent can be answering calls today.
            </Text>

            <View className="mt-8 gap-4">
              {/* Name */}
              <View className="gap-1.5">
                <Text className="text-[13px] font-medium">Your name</Text>
                <Input
                  placeholder="Pavan"
                  value={name}
                  onChangeText={setName}
                  autoComplete="name"
                />
              </View>

              {/* Phone */}
              <View className="gap-1.5">
                <Text className="text-[13px] font-medium">Phone number</Text>
                <Input
                  placeholder="9876543210"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                />
              </View>

              {error ? (
                <Text variant="destructive" className="text-[13px]">
                  {error}
                </Text>
              ) : null}

              {/* Submit */}
              <Button onPress={handleSubmit} loading={loading} className="mt-1">
                Create account
              </Button>
            </View>

            {/* Footer */}
            <View className="mt-8 items-center">
              <Text variant="muted" className="text-[13px]">
                Already have one?{" "}
                <Link href="/(auth)/sign-in" asChild>
                  <Pressable>
                    <Text className="text-sm font-medium underline">Login with number</Text>
                  </Pressable>
                </Link>
              </Text>
            </View>

            <Text variant="muted" className="mt-4 text-center text-[11px]">
              By continuing you agree to the terms and the privacy policy.
            </Text>
          </View>

          {/* Copyright */}
          <Text variant="muted" className="text-center text-[11px]">
            © Rivervoice · Terms · Privacy
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
