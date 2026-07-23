// Logo animatsiyalarini ko'rish uchun demo ekran — artifactdagi yangi belgi.
// Intro'ga bosilsa qayta o'ynaydi; pastda loading loaderning ikki ko'rinishi.
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AnimatedLogo } from "@/components/animated-logo";

export default function LogoDemo() {
  const [run, setRun] = useState(0);
  return (
    <View style={styles.root}>
      <Pressable style={styles.block} onPress={() => setRun((n) => n + 1)}>
        <AnimatedLogo key={run} variant="intro" size={150} />
        <Text style={styles.hint}>intro — qayta ko&rsquo;rish uchun bosing</Text>
      </Pressable>
      <View style={styles.row}>
        <View style={styles.block}>
          <AnimatedLogo variant="loading" size={72} />
          <Text style={styles.hint}>loading (ikon)</Text>
        </View>
        <View style={styles.block}>
          <AnimatedLogo variant="loading" size={72} background={null} />
          <Text style={styles.hint}>loading (fonsiz)</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", gap: 40, backgroundColor: "#0c1310" },
  row: { flexDirection: "row", gap: 40 },
  block: { alignItems: "center", gap: 14 },
  hint: { color: "rgba(255,255,255,0.45)", fontSize: 13 },
});
