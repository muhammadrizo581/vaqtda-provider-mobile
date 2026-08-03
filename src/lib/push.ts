// Push xabarnomalar — mijoz ilovasidagi lib/push.ts bilan bir xil sxema:
// Expo push token olinadi va profiles.push_token ga yoziladi. Server tomonda
// notifications jadvaliga yozuv tushsa, DB trigger Expo Push API'ga yuboradi.
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";

// Ilova ochiq turganda ham banner ko'rinsin
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(userId: string): Promise<void> {
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
