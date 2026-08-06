import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { getQrMatrix } from "@/utils/qrcode";
import { colors } from "@/theme/colors";

interface QrCodeProps {
  value: string;
  size: number;
}

// Zona quieta exigida pela especificação de QR code (margem de módulos claros ao redor da
// matriz) — sem ela, leitores podem falhar ao detectar o código dependendo do que estiver
// visualmente adjacente. `moduleSize` é arredondado para baixo antes de calcular o tamanho real
// renderizado (em vez de dividir `size` diretamente pela contagem de módulos) para garantir uma
// grade de pixels inteiros — módulos com tamanho fracionário sofrem arredondamento
// independente por célula no React Native, criando frestas irregulares entre eles.
const QUIET_ZONE_MODULES = 4;

export function QrCode({ value, size }: QrCodeProps) {
  const matrix = useMemo(() => getQrMatrix(value), [value]);
  const moduleSize = Math.floor(size / (matrix.length + QUIET_ZONE_MODULES * 2));
  const contentSize = moduleSize * (matrix.length + QUIET_ZONE_MODULES * 2);
  const padding = moduleSize * QUIET_ZONE_MODULES;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Código QR ${value}`}
      style={[styles.container, { width: contentSize, height: contentSize, padding }]}
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
