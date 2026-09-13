// Joylashuv tanlagich — Yandex Maps JS API (WebView) + Expo Location GPS integratsiyasi.
// To'liq ekranli interaktiv xarita, qidiruv, avtomatik manzil aniqlash (geocoding)
// va bir bosishda "Mening joylashuvim" funksiyalarini ta'minlaydi.
import * as Location from "expo-location";
import {
  Check,
  Crosshair,
  MapPin,
  Maximize2,
  Navigation,
  X,
} from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { alpha, radius } from "@/constants/colors";
import { useLanguage } from "@/context/LanguageContext";
import { makeThemedStyles, useColors } from "@/context/ThemeContext";

const YANDEX_MAPS_KEY = "6bac23fd-42ad-42d1-aceb-3fd1630a9ac8";

export function LocationPicker({
  coordinates,
  onChange,
  readOnly = false,
}: {
  coordinates: [number, number]; // [lat, lng]
  onChange: (coords: [number, number], address?: string) => void;
  /** Faqat ko'rish (masalan, klinika xodimi uchun): nuqta ko'chirilmaydi */
  readOnly?: boolean;
}) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useLanguage();

  const [lat, lng] = coordinates;
  const [modalOpen, setModalOpen] = useState(false);
  const [address, setAddress] = useState<string>("");
  const [gpsLoading, setGpsLoading] = useState(false);

  // Modal ichidagi tanlangan koordinata va manzil
  const [tempCoords, setTempCoords] = useState<[number, number]>(coordinates);
  const [tempAddress, setTempAddress] = useState<string>(address);

  const modalWebViewRef = useRef<WebView>(null);

  // Koordinatalar o'zgarganda Expo Location orqali manzilni zaxira sifatida aniqlaymiz
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [geo] = await Location.reverseGeocodeAsync({
          latitude: lat,
          longitude: lng,
        });
        if (geo && active) {
          const parts = [
            geo.city || geo.region,
            geo.district,
            geo.street || geo.name,
          ].filter(Boolean);
          if (parts.length > 0) {
            const resolved = parts.join(", ");
            setAddress((prev) => (prev && prev !== t("ab.loading_map") ? prev : resolved));
          }
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      active = false;
    };
  }, [lat, lng, t]);

  // Modal ochilganda joriy koordinatani yuklaymiz
  const handleOpenModal = () => {
    if (readOnly) return;
    setTempCoords(coordinates);
    setTempAddress(address);
    setModalOpen(true);
  };

  // GPS orqali qurilmaning aniq joylashuvini olish
  const handleGetMyLocation = async (inModal = false) => {
    try {
      setGpsLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          t("ab.location_permission_denied") || "Ruxsat berilmadi",
          "Joylashuvni avtomatik aniqlash uchun ruxsat kerak."
        );
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const newCoords: [number, number] = [
        Number(loc.coords.latitude.toFixed(6)),
        Number(loc.coords.longitude.toFixed(6)),
      ];

      if (inModal) {
        setTempCoords(newCoords);
        if (modalWebViewRef.current) {
          modalWebViewRef.current.injectJavaScript(`
            if (window.setCoordinates) {
              window.setCoordinates(${newCoords[0]}, ${newCoords[1]}, 16);
            }
            true;
          `);
        }
      } else {
        onChange(newCoords);
      }
    } catch (err) {
      console.warn("GPS joylashuvni aniqlashda xatolik:", err);
      Alert.alert(t("ab.address_not_found") || "Xatolik", "Joylashuvni aniqlab bo'lmadi.");
    } finally {
      setGpsLoading(false);
    }
  };

  // Modalda tanlangan joyni tasdiqlash
  const handleConfirmModal = () => {
    onChange(tempCoords, tempAddress);
    if (tempAddress) setAddress(tempAddress);
    setModalOpen(false);
  };

  // WebView uchun HTML shablon
  const generateMapHtml = (initCoords: [number, number], isInteractive: boolean) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <script src="https://api-maps.yandex.ru/2.1/?apikey=${YANDEX_MAPS_KEY}&lang=ru_RU"></script>
  <style>
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #16211b; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
    .ymaps-2-1-79-map { background: #16211b !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    window.__coords = [${initCoords[0]}, ${initCoords[1]}];
    window.__isInteractive = ${isInteractive ? "true" : "false"};
    window.map = null;
    window.placemark = null;

    function sendToRN(payload) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    }

    function doGeocode(coords) {
      if (!window.ymaps || !ymaps.geocode) return;
      ymaps.geocode(coords, { results: 1 }).then(function(res) {
        var obj = res.geoObjects.get(0);
        var addr = '';
        if (obj) {
          try {
            if (typeof obj.getAddressLine === 'function') {
              addr = obj.getAddressLine();
            }
          } catch(e) {}
          if (!addr && obj.properties) {
            addr = obj.properties.get('text') || obj.properties.get('name') || '';
          }
        }
        sendToRN({
          type: 'change',
          coords: [Number(coords[0].toFixed(6)), Number(coords[1].toFixed(6))],
          address: addr || ''
        });
      }).catch(function() {
        sendToRN({
          type: 'change',
          coords: [Number(coords[0].toFixed(6)), Number(coords[1].toFixed(6))],
          address: ''
        });
      });
    }

    window.setCoordinates = function(lat, lng, zoom) {
      var newCoords = [Number(lat), Number(lng)];
      window.__coords = newCoords;
      if (window.map && window.placemark) {
        window.map.setCenter(newCoords, zoom || window.map.getZoom() || 15, { checkZoomRange: true, duration: 250 });
        window.placemark.geometry.setCoordinates(newCoords);
        doGeocode(newCoords);
      }
    };

    ymaps.ready(function() {
      var startCoords = window.__coords;
      window.map = new ymaps.Map('map', {
        center: startCoords,
        zoom: 15,
        controls: window.__isInteractive ? ['zoomControl', 'searchControl'] : ['zoomControl']
      }, {
        suppressMapOpenBlock: true
      });

      window.placemark = new ymaps.Placemark(startCoords, {
        balloonContent: 'Biznes joylashuvi'
      }, {
        draggable: window.__isInteractive,
        preset: 'islands#redDotIconWithCaption'
      });
      window.map.geoObjects.add(window.placemark);

      if (window.__isInteractive) {
        var searchControl = window.map.controls.get('searchControl');
        if (searchControl) {
          searchControl.options.set('noPlacemark', true);
          searchControl.events.add('resultselect', function(e) {
            var index = e.get('index');
            searchControl.getResult(index).then(function(res) {
              var c = res.geometry.getCoordinates();
              window.placemark.geometry.setCoordinates(c);
              window.__coords = c;
              var addr = '';
              if (res.properties) {
                addr = res.properties.get('text') || res.properties.get('name') || '';
              }
              sendToRN({
                type: 'change',
                coords: [Number(c[0].toFixed(6)), Number(c[1].toFixed(6))],
                address: addr
              });
            });
          });
        }

        window.placemark.events.add('dragend', function() {
          var c = window.placemark.geometry.getCoordinates();
          window.__coords = c;
          doGeocode(c);
        });

        window.map.events.add('click', function(e) {
          var c = e.get('coords');
          window.placemark.geometry.setCoordinates(c);
          window.__coords = c;
          doGeocode(c);
        });
      }

      sendToRN({ type: 'ready' });
      doGeocode(startCoords);
    });
  </script>
</body>
</html>`;

  // Asosiy xarita HTML har doim eng so'nggi koordinatani oladi
  const inlineHtml = useMemo(
    () => generateMapHtml([lat, lng], false),
    [lat, lng]
  );

  // Modal xaritasi ochilganda joriy koordinatani oladi
  const modalHtml = useMemo(
    () => generateMapHtml([lat, lng], true),
    [lat, lng]
  );

  return (
    <View style={styles.container}>
      {/* Kichik Xarita Preview */}
      <View style={styles.mapWrap}>
        <WebView
          key={`inline_${coordinates[0]}_${coordinates[1]}`}
          source={{ html: inlineHtml }}
          style={{ backgroundColor: colors.surfaceContainer }}
          scrollEnabled={false}
          onMessage={(e) => {
            try {
              const data = JSON.parse(e.nativeEvent.data);
              if (data.type === "change" && Array.isArray(data.coords)) {
                if (data.address) setAddress(data.address);
              }
            } catch {
              /* ignore */
            }
          }}
        />

        {/* Xaritani bosganda yoki tahrirlashda kattalashtirish uchun qatlam */}
        {!readOnly && (
          <Pressable style={styles.mapOverlayPressable} onPress={handleOpenModal}>
            <View style={styles.mapExpandBadge}>
              <Maximize2 size={13} color="#ffffff" />
              <Text style={styles.mapExpandText}>{t("ab.map_picker")}</Text>
            </View>
          </Pressable>
        )}
      </View>

      {/* Manzil va Koordinatalar bloki */}
      <View style={styles.infoCard}>
        <View style={styles.addressRow}>
          <MapPin size={16} color={colors.primary} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.addressText} numberOfLines={2}>
              {address || t("ab.loading_map")}
            </Text>
            <Text style={styles.coordsText}>
              {coordinates[0].toFixed(5)}, {coordinates[1].toFixed(5)}
            </Text>
          </View>
        </View>

        {!readOnly && (
          <View style={styles.actionsRow}>
            {/* Mening joylashuvim tugmasi */}
            <Pressable
              onPress={() => handleGetMyLocation(false)}
              disabled={gpsLoading}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: alpha(colors.primaryContainer, 0.25) },
                pressed && { opacity: 0.8 },
              ]}
            >
              {gpsLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Crosshair size={15} color={colors.primary} />
              )}
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>
                {t("ab.my_location")}
              </Text>
            </Pressable>

            {/* Xaritadan tanlash (to'liq ekran) */}
            <Pressable
              onPress={handleOpenModal}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: alpha(colors.secondaryContainer, 0.25) },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Navigation size={15} color={colors.secondary} />
              <Text style={[styles.actionBtnText, { color: colors.secondary }]}>
                {t("ab.map_picker")}
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* TO'LIQ EKRANLI XARITA MODALI */}
      <Modal visible={modalOpen} animationType="slide" transparent={false}>
        <SafeAreaView style={[styles.fullModal, { backgroundColor: colors.background }]}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{t("ab.map_picker")}</Text>
              <Text style={styles.modalSub}>{t("ab.map_instruction")}</Text>
            </View>
            <Pressable onPress={() => setModalOpen(false)} style={styles.closeBtn}>
              <X size={20} color={colors.onSurface} />
            </Pressable>
          </View>

          {/* Xarita WebView */}
          <View style={styles.modalMapWrap}>
            <WebView
              ref={modalWebViewRef}
              source={{ html: modalHtml }}
              style={{ flex: 1, backgroundColor: colors.surfaceContainer }}
              onMessage={(e) => {
                try {
                  const data = JSON.parse(e.nativeEvent.data);
                  if (data.type === "change" && Array.isArray(data.coords)) {
                    setTempCoords([
                      Number(data.coords[0].toFixed(6)),
                      Number(data.coords[1].toFixed(6)),
                    ]);
                    if (data.address) setTempAddress(data.address);
                  }
                } catch {
                  /* ignore */
                }
              }}
            />

            {/* Modal ichidagi "Mening joylashuvim" suzuvchi tugmasi */}
            <Pressable
              onPress={() => handleGetMyLocation(true)}
              disabled={gpsLoading}
              style={({ pressed }) => [
                styles.floatingGpsBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              {gpsLoading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Crosshair size={20} color="#ffffff" />
              )}
            </Pressable>
          </View>

          {/* Modal Bottom Sheet: Tanlangan manzil va Tasdiqlash */}
          <View style={styles.modalBottom}>
            <View style={styles.modalAddressRow}>
              <MapPin size={18} color={colors.primary} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.modalAddressText} numberOfLines={2}>
                  {tempAddress || t("ab.loading_map")}
                </Text>
                <Text style={styles.coordsText}>
                  {tempCoords[0].toFixed(5)}, {tempCoords[1].toFixed(5)}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={handleConfirmModal}
              style={({ pressed }) => [
                styles.confirmBtn,
                { backgroundColor: colors.primary },
                pressed && { opacity: 0.9 },
              ]}
            >
              <Check size={18} color={colors.onPrimary} />
              <Text style={[styles.confirmBtnText, { color: colors.onPrimary }]}>
                {t("ab.confirm_location")}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    container: {
      gap: 10,
    },
    mapWrap: {
      height: 180,
      borderRadius: radius.lg,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      position: "relative",
    },
    mapOverlayPressable: {
      position: "absolute",
      bottom: 10,
      right: 10,
    },
    mapExpandBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(0,0,0,0.75)",
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.2)",
    },
    mapExpandText: {
      color: "#ffffff",
      fontSize: 12,
      fontWeight: "600",
    },
    infoCard: {
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: radius.md,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      gap: 10,
    },
    addressRow: {
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-start",
    },
    addressText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.onSurface,
      lineHeight: 18,
    },
    coordsText: {
      fontSize: 11,
      color: colors.onSurfaceVariant,
      marginTop: 2,
    },
    actionsRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 2,
    },
    actionBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 9,
      paddingHorizontal: 10,
      borderRadius: radius.md,
    },
    actionBtnText: {
      fontSize: 12,
      fontWeight: "600",
    },

    // To'liq ekranli modal
    fullModal: {
      flex: 1,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.outlineVariant,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.onSurface,
    },
    modalSub: {
      fontSize: 11,
      color: colors.onSurfaceVariant,
      marginTop: 2,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: alpha(colors.surfaceContainerHighest, 0.6),
      alignItems: "center",
      justifyContent: "center",
    },
    modalMapWrap: {
      flex: 1,
      position: "relative",
    },
    floatingGpsBtn: {
      position: "absolute",
      bottom: 20,
      right: 16,
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: "#10b981",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 6,
      elevation: 8,
    },
    modalBottom: {
      padding: 16,
      backgroundColor: colors.surfaceContainerLowest,
      borderTopWidth: 1,
      borderTopColor: colors.outlineVariant,
      gap: 14,
    },
    modalAddressRow: {
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-start",
    },
    modalAddressText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.onSurface,
      lineHeight: 20,
    },
    confirmBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: radius.lg,
    },
    confirmBtnText: {
      fontSize: 15,
      fontWeight: "700",
    },
  })
);
