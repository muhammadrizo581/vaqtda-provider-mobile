// Kirish splash'i — VaqtdaIntro, provayder UI (indigo) ranglarida:
// indigo radial gradient → barglar gullab ochiladi → galochka chiziladi →
// "Vaqtda" so'zi ko'tariladi → sahna xiralashib yo'qoladi (~2.4s), so'ng onDone.
import React from "react";
import { VaqtdaIntro } from "@/components/vaqtda-logo";

export function VaqtdaSplash({
  onDone,
  duration,
}: {
  /** Fade tugagach chaqiriladi */
  onDone?: () => void;
  /** Moslik uchun saqlangan — taymlayn VaqtdaIntro ichida qat'iy (~2.4s) */
  duration?: number;
}) {
  void duration;
  return <VaqtdaIntro onDone={onDone ?? (() => {})} />;
}
