import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router, Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Brand, Button, Field, Muted } from "../components/ui";
import { useAuth } from "../lib/auth";
import { C } from "../lib/theme";

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (user) return <Redirect href="/home" />;
  async function submit(demo = false) {
    if (!demo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address, such as name@gmail.com.");
      return;
    }
    if (!demo && !password) {
      setError("Enter your password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await login(email, password, demo);
      router.replace("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            padding: 24,
            justifyContent: "center",
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Brand />
          <View style={{ height: 65 }} />
          <Text
            style={{
              color: C.lime,
              fontWeight: "900",
              fontSize: 11,
              letterSpacing: 2.2,
            }}
          >
            YOUR TRADING WORKSPACE
          </Text>
          <Text
            style={{
              color: C.white,
              fontWeight: "900",
              fontSize: 44,
              letterSpacing: -2.5,
              lineHeight: 48,
              marginTop: 14,
            }}
          >
            Clarity in every{"\n"}market move.
          </Text>
          <Text
            style={{
              color: C.muted,
              lineHeight: 23,
              fontSize: 15,
              marginTop: 17,
              marginBottom: 35,
            }}
          >
            Research, approve and monitor your trades from one focused mobile
            workspace.
          </Text>
          <Field
            label="Email address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Your password"
          />
          {error ? (
            <Text style={{ color: C.red, marginBottom: 12 }}>{error}</Text>
          ) : null}
          <Button
            title="Sign in"
            onPress={() => void submit()}
            loading={busy}
            icon="arrow-right"
          />
          <Pressable
            onPress={() => router.push("/forgot")}
            style={{ alignItems: "center", marginTop: 22 }}
          >
            <Text style={{ color: C.lime, fontWeight: "800" }}>
              Forgot password?
            </Text>
          </Pressable>
          <View style={{ height: 25 }} />
          <Button
            title="Explore user demo"
            secondary
            onPress={() => void submit(true)}
            disabled={busy}
          />
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              marginTop: 28,
              gap: 5,
            }}
          >
            <Muted>New to Enrivea?</Muted>
            <Pressable onPress={() => router.push("/register")}>
              <Text style={{ color: C.lime, fontWeight: "800" }}>
                Create account
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
