// Logo animatsiyasini ko'rish uchun demo ekran — yakuniy ko'rinish:
// fonsiz, sayt yashili (#8DAE91). Intro'ga bosilsa qayta o'ynaydi.
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AnimatedLogo } from "@/components/animated-logo";

export default function LogoDemo() {
  const [run, setRun] = useState(0);
  return (
    <View style={styles.root}>
      <Pressable style={styles.block} onPress={() => setRun((n) => n + 1)}>
        <AnimatedLogo key={run} variant="intro" size={170} background={null} />
        <Text style={styles.hint}>intro — qayta ko&rsquo;rish uchun bosing</Text>
      </Pressable>
      <View style={styles.block}>
        <AnimatedLogo variant="loading" size={80} background={null} />
        <Text style={styles.hint}>loading</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", gap: 48, backgroundColor: "#0b1326" },
  block: { alignItems: "center", gap: 14 },
  hint: { color: "rgba(255,255,255,0.45)", fontSize: 13 },
});
