// Foydalanish shartlari — biznes (provayder) uchun. Ro'yxatdan o'tishda va
// sozlamalarda ochiladi (App Store Guideline 1.2: foydalanuvchi kontentiga nol toqat).
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/pv/screen";
import { Card, GlassIconButton } from "@/components/pv/ui";
import { useLanguage } from "@/context/LanguageContext";
import { makeThemedStyles, useColors } from "@/context/ThemeContext";

const SECTIONS: { uz: [string, string]; ru: [string, string] }[] = [
  {
    uz: [
      "Xizmat haqida",
      "«Vaqtda Provider» — bizneslar (sartaroshxona, klinika, restoran, ijara va boshqalar) uchun onlayn bronlarni qabul qilish, jadval, xodimlar va mijozlar bilan ishlash ilovasi. Biznes o'z xizmatlari, narxlari va ma'lumotlarining to'g'riligi uchun o'zi javobgar.",
    ],
    ru: [
      "О сервисе",
      "«Vaqtda Provider» — приложение для бизнеса (барбершопы, клиники, рестораны, аренда и др.): приём онлайн-записей, расписание, сотрудники и работа с клиентами. Бизнес сам отвечает за свои услуги, цены и достоверность информации.",
    ],
  },
  {
    uz: [
      "Hisob",
      "Ro'yxatdan o'tishda telefon raqami SMS kod orqali tasdiqlanadi. Hisobingiz xavfsizligi uchun o'zingiz javobgarsiz. Hisobni istalgan vaqtda «Sozlamalar → Hisobni o'chirish» orqali o'chirishingiz mumkin.",
    ],
    ru: [
      "Аккаунт",
      "При регистрации номер телефона подтверждается SMS-кодом. Вы отвечаете за безопасность своего аккаунта. Удалить аккаунт можно в любой момент: «Настройки → Удалить аккаунт».",
    ],
  },
  {
    uz: [
      "Mijozlar bilan muloqot — nol toqat",
      "Chatda haqorat, tahdid, kamsitish, spam, firibgarlik, behayo yoki noqonuniy kontentga mutlaqo yo'l qo'yilmaydi.\n• Har qanday xabar yoki suhbat ustidan «Shikoyat qilish» mumkin.\n• Mijozni «Bloklash» mumkin — u sizga boshqa yoza olmaydi.\n• Nomaqbul so'zlar avtomatik filtrlanadi.\n• Moderatorlar shikoyatlarni 24 soat ichida ko'rib chiqadi, qoidabuzar kontentni o'chiradi va buzuvchining hisobini bloklaydi.",
    ],
    ru: [
      "Общение с клиентами — нулевая терпимость",
      "В чатах категорически запрещены оскорбления, угрозы, дискриминация, спам, мошенничество, непристойный или незаконный контент.\n• На любое сообщение или диалог можно «Пожаловаться».\n• Клиента можно «Заблокировать» — он больше не сможет вам писать.\n• Недопустимые слова фильтруются автоматически.\n• Модераторы рассматривают жалобы в течение 24 часов, удаляют нарушающий контент и блокируют аккаунт нарушителя.",
    ],
  },
  {
    uz: [
      "Bronlar va to'lovlar",
      "Mijozlardan olinadigan oldindan to'lovlar Click yoki Payme orqali amalga oshiriladi. Bekor qilish va qaytarish shartlarini biznes o'zi belgilaydi va mijozlarga ochiq ko'rsatadi.",
    ],
    ru: [
      "Записи и платежи",
      "Предоплаты от клиентов проводятся через Click или Payme. Условия отмены и возврата бизнес устанавливает сам и открыто показывает клиентам.",
    ],
  },
  {
    uz: [
      "Aloqa",
      "Savollar va shikoyatlar uchun: support@vaqtda.uz yoki Telegram @VaqtdaSupportBot.",
    ],
    ru: [
      "Контакты",
      "По вопросам и жалобам: support@vaqtda.uz или Telegram @VaqtdaSupportBot.",
    ],
  },
];

export default function TermsScreen() {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const { t, lang } = useLanguage();

  return (
    <Screen>
      <View style={styles.headerRow}>
        <GlassIconButton onPress={() => router.back()}>
          <ArrowLeft size={18} color={colors.onSurfaceVariant} />
        </GlassIconButton>
        <Text style={styles.title}>{t("mod.terms")}</Text>
      </View>

      {SECTIONS.map((sec, i) => {
        const [title, text] = lang === "ru" ? sec.ru : sec.uz;
        return (
          <Card key={title} style={styles.card}>
            <Text style={styles.num}>{String(i + 1).padStart(2, "0")}</Text>
            <Text style={styles.secTitle}>{title}</Text>
            <Text style={styles.secText}>{text}</Text>
          </Card>
        );
      })}
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    title: { fontSize: 20, fontWeight: "800", color: colors.onSurface, letterSpacing: -0.3 },
    card: { padding: 16, gap: 6 },
    num: { fontSize: 11, fontWeight: "800", color: colors.outline, letterSpacing: 1 },
    secTitle: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
    secText: { fontSize: 13, lineHeight: 20, color: colors.onSurfaceVariant },
  })
);
