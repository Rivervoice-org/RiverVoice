import { useState } from "react";
import {
  View,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Link, router } from "expo-router";
import { Waves } from "lucide-react-native";
import { useAuth } from "@/state/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!name || !email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await signUp({ name, email, password });
      router.replace("/(tabs)");
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
              <Waves size={14} strokeWidth={2} color="#3c3832" />
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

              {/* Email */}
              <View className="gap-1.5">
                <Text className="text-[13px] font-medium">Work email</Text>
                <Input
                  placeholder="you@company.com"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
              </View>

              {/* Password */}
              <View className="gap-1.5">
                <Text className="text-[13px] font-medium">Password</Text>
                <Input
                  placeholder="At least 8 characters"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="new-password"
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

            {/* Divider */}
            <View className="my-8 flex-row items-center gap-3">
              <Separator className="flex-1" />
              <Text variant="muted" className="text-[11px]">
                or
              </Text>
              <Separator className="flex-1" />
            </View>

            {/* Google */}
            <Button variant="outline">Continue with Google</Button>

            {/* Footer */}
            <View className="mt-8 items-center">
              <Text variant="muted" className="text-[13px]">
                Already have one?{" "}
                <Link href="/(auth)/sign-in" asChild>
                  <Pressable>
                    <Text className="text-sm font-medium underline">Sign in</Text>
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
