import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Link, router } from "expo-router";
import { Waves } from "lucide-react-native";
import { useAuth } from "../../lib/auth-context";

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
      router.replace("/(tabs)");
    } catch {
      setError("Invalid email or password.");
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
            <Text className="text-sm font-medium text-foreground">
              Rivervoice
            </Text>
          </View>

          {/* Form */}
          <View className="mt-auto mb-auto">
            <Text className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
              Sign in
            </Text>
            <Text className="mt-2 text-sm text-muted-foreground">
              Pick up where your agents left off.
            </Text>

            <View className="mt-8 gap-4">
              {/* Email */}
              <View className="gap-1.5">
                <Text className="text-[13px] font-medium text-foreground">
                  Work email
                </Text>
                <TextInput
                  className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground"
                  placeholder="you@company.com"
                  placeholderTextColor="#8f8c87"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
              </View>

              {/* Password */}
              <View className="gap-1.5">
                <View className="flex-row items-baseline justify-between">
                  <Text className="text-[13px] font-medium text-foreground">
                    Password
                  </Text>
                  <Pressable>
                    <Text className="text-xs text-muted-foreground">
                      Use a code instead
                    </Text>
                  </Pressable>
                </View>
                <TextInput
                  className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground"
                  placeholder="••••••••"
                  placeholderTextColor="#8f8c87"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="current-password"
                />
              </View>

              {error ? (
                <Text className="text-[13px] text-destructive">{error}</Text>
              ) : null}

              {/* Submit */}
              <Pressable
                onPress={handleSubmit}
                disabled={loading}
                className="mt-1 h-10 flex-row items-center justify-center rounded-lg bg-foreground"
              >
                {loading ? (
                  <ActivityIndicator color="#fcfbf9" size="small" />
                ) : (
                  <Text className="text-sm font-medium text-primary-foreground">
                    Sign in
                  </Text>
                )}
              </Pressable>
            </View>

            {/* Divider */}
            <View className="my-8 flex-row items-center gap-3">
              <View className="h-px flex-1 bg-border" />
              <Text className="text-[11px] text-muted-foreground">or</Text>
              <View className="h-px flex-1 bg-border" />
            </View>

            {/* Google */}
            <Pressable className="h-10 flex-row items-center justify-center gap-2.5 rounded-lg border border-border bg-card">
              <Text className="text-sm font-medium text-foreground">
                Continue with Google
              </Text>
            </Pressable>

            {/* Footer */}
            <View className="mt-8 items-center">
              <Text className="text-[13px] text-muted-foreground">
                New here?{" "}
                <Link href="/(auth)/sign-up" asChild>
                  <Pressable>
                    <Text className="text-sm font-medium text-foreground underline">
                      Create an account
                    </Text>
                  </Pressable>
                </Link>
              </Text>
            </View>
          </View>

          {/* Copyright */}
          <Text className="text-center text-[11px] text-muted-foreground">
            © Rivervoice · Terms · Privacy
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
