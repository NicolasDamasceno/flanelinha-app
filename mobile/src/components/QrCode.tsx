import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { getQrMatrix } from "@/utils/qrcode";
import { colors } from "@/theme/colors";

interface QrCodeProps {
  value: string;
  size: number;
}

export function QrCode({ value, size }: QrCodeProps) {
  const matrix = useMemo(() => getQrMatrix(value), [value]);
  const moduleSize = size / matrix.length;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Código QR ${value}`}
      style={[styles.container, { width: size, height: size }]}
    >
      {matrix.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((isDark, colIndex) => (
            <View
              key={colIndex}
              style={{
                width: moduleSize,
                height: moduleSize,
                backgroundColor: isDark ? colors.text : colors.background,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
  },
  row: {
    flexDirection: "row",
  },
});
