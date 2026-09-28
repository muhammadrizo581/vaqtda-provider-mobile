// Push xabarnomalar — mijoz ilovasidagi lib/push.ts bilan bir xil sxema:
// Expo push token olinadi va profiles.push_token ga yoziladi. Server tomonda
// notifications jadvaliga yozuv tushsa, DB trigger Expo Push API'ga yuboradi.
import Constants from "expo-constants";
import * as Device from "expo-device";
import { isRunningInExpoGo } from "expo";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";

export const isAndroidExpoGo =
  Platform.OS === "android" &&
  (isRunningInExpoGo() ||
    (Constants as any)?.appOwnership === "expo" ||
    (Constants as any)?.executionEnvironment === "storeClient");

export function getNotifications(): typeof import("expo-notifications") | null {
  if (isAndroidExpoGo) return null;
  try {
    // Dinamik require ataylab: Android Expo Go'da modulni yuklashning o'zi xato beradi
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-notifications");
  } catch {
    return null;
  }
}

const Notifications = getNotifications();

// Ilova ochiq turganda ham banner ko'rinsin
if (Notifications?.setNotificationHandler) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch {
    /* ignore */
  }
}

export async function registerForPushNotifications(userId: string): Promise<void> {
  if (isAndroidExpoGo || !Notifications) return;
  try {
    // Simulyatorda push token bo'lmaydi
    if (!Device.isDevice) return;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== "granted") return;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    const token = (
      await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)
    ).data;

    await supabase.from("profiles").update({ push_token: token }).eq("id", userId);
  } catch {
    // Expo Go (Android) da remote push yo'q — jimgina o'tamiz
  }
}

export async function clearPushToken(userId: string): Promise<void> {
  try {
    await supabase.from("profiles").update({ push_token: null }).eq("id", userId);
  } catch {
    /* ignore */
  }
}
