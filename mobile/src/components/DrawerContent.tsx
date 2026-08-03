import { router, type Href } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { colors } from "@/theme/colors";

export interface DrawerMenuItem {
  label: string;
  route: Href;
}

interface DrawerContentProps {
  items: DrawerMenuItem[];
}

export function DrawerContent({ items }: DrawerContentProps) {
  const { logout } = useAuth();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {items.map((item) => (
        <Pressable
          key={item.route.toString()}
          style={styles.item}
          onPress={() => router.push(item.route)}
          accessibilityRole="button"
        >
          <Text style={styles.itemLabel}>{item.label}</Text>
        </Pressable>
      ))}
      <Pressable style={styles.item} onPress={() => logout()} accessibilityRole="button">
        <Text style={[styles.itemLabel, styles.logoutLabel]}>Sair</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  item: {
    paddingVertical: 14,
  },
  itemLabel: {
    fontSize: 16,
    color: colors.text,
  },
  logoutLabel: {
    color: colors.error,
    fontWeight: "600",
  },
});
