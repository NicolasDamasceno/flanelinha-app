import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/colors";

interface BannerProps {
  type: "error" | "success";
  message: string;
}

export function Banner({ type, message }: BannerProps) {
  const isError = type === "error";

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isError ? colors.errorBackground : colors.successBackground },
      ]}
    >
      <Text style={{ color: isError ? colors.error : colors.success }}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
});
