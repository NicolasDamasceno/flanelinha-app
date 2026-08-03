import { router, usePathname, type Href } from "expo-router";
import { DrawerContentScrollView } from "@react-navigation/drawer";
import { Pressable, StyleSheet, Text } from "react-native";
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
  const pathname = usePathname();

  return (
    <DrawerContentScrollView contentContainerStyle={styles.container}>
      {items.map((item) => (
        <Pressable
          key={item.label}
          style={[styles.item, pathname === item.route && styles.itemActive]}
          onPress={() => router.push(item.route)}
          accessibilityRole="button"
          accessibilityState={{ selected: pathname === item.route }}
        >
          <Text style={styles.itemLabel}>{item.label}</Text>
        </Pressable>
      ))}
      <Pressable style={styles.item} onPress={() => logout()} accessibilityRole="button">
        <Text style={[styles.itemLabel, styles.logoutLabel]}>Sair</Text>
      </Pressable>
    </DrawerContentScrollView>
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
  itemActive: {
    backgroundColor: "#EFF6FF",
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
