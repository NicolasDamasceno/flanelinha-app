import { View } from "react-native";
import { getQrMatrix } from "@/utils/qrcode";
import { colors } from "@/theme/colors";

interface QrCodeProps {
  value: string;
  size: number;
}

export function QrCode({ value, size }: QrCodeProps) {
  const matrix = getQrMatrix(value);
  const moduleSize = size / matrix.length;

  return (
    <View style={{ width: size, height: size, backgroundColor: colors.background }}>
      {matrix.map((row, rowIndex) => (
        <View key={rowIndex} style={{ flexDirection: "row" }}>
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
