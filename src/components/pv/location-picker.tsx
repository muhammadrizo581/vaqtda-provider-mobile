// Joylashuv tanlagich — web'dagi Yandex Maps LocationPicker o'rnida.
// WebView ichida Yandex Maps JS API: markerni sudrab lat/lng tanlanadi.
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { radius } from "@/constants/colors";
import { makeThemedStyles, useColors } from "@/context/ThemeContext";

const YANDEX_MAPS_KEY = "6bac23fd-42ad-42d1-aceb-3fd1630a9ac8";

export function LocationPicker({
  coordinates,
  onChange,
  readOnly = false,
}: {
  coordinates: [number, number]; // [lat, lng]
  onChange: (coords: [number, number]) => void;
  /** Faqat ko'rish (masalan, klinika xodimi uchun): nuqta ko'chirilmaydi */
  readOnly?: boolean;
}) {
  const colors = useColors();
  const styles = useStyles();
  const html = useMemo(
    () => `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
  <script src="https://api-maps.yandex.ru/2.1/?apikey=${YANDEX_MAPS_KEY}&lang=ru_RU"></script>
  <style>html,body,#map{margin:0;padding:0;width:100%;height:100%;background:#16211b;}</style>
</head>
<body>
  <div id="map"></div>
  <script>
    ymaps.ready(function () {
      var readOnly = ${readOnly ? "true" : "false"};
      var map = new ymaps.Map('map', {
        center: [${coordinates[0]}, ${coordinates[1]}],
        zoom: 13,
        controls: ['zoomControl'],
      });
      var placemark = new ymaps.Placemark([${coordinates[0]}, ${coordinates[1]}], {}, {
        draggable: !readOnly,
        preset: 'islands#violetDotIcon',
      });
      map.geoObjects.add(placemark);
      function report() {
        var c = placemark.geometry.getCoordinates();
        window.ReactNativeWebView.postMessage(JSON.stringify(c));
      }
      if (!readOnly) {
        placemark.events.add('dragend', report);
        map.events.add('click', function (e) {
          placemark.geometry.setCoordinates(e.get('coords'));
          report();
        });
      }
    });
  </script>
</body>
</html>`,
    // Xarita bir marta yaratiladi — koordinata o'zgarishida qayta yuklamaymiz
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <View style={styles.wrap}>
      <WebView
        source={{ html }}
        style={{ backgroundColor: colors.surfaceContainer }}
        onMessage={(e) => {
          try {
            const c = JSON.parse(e.nativeEvent.data);
            if (Array.isArray(c) && c.length === 2) {
              onChange([Number(c[0].toFixed(6)), Number(c[1].toFixed(6))]);
            }
          } catch {
            /* e'tiborsiz */
          }
        }}
      />
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  wrap: {
    height: 240,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
}));
