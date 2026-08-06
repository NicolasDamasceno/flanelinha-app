import { Image, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/colors";

interface AvatarProps {
  base64: string | null;
  size: number;
}

export function Avatar({ base64, size }: AvatarProps) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={base64 ? "Foto do Flanelinha" : "Sem foto"}
      style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}
    >
      {base64 ? (
        <Image
          source={{ uri: `data:image/jpeg;base64,${base64}` }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
        />
      ) : (
        <Text style={{ fontSize: size * 0.4 }}>👤</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
