import { Drawer } from "expo-router/drawer";
import { DrawerContent, type DrawerMenuItem } from "@/components/DrawerContent";
import { colors } from "@/theme/colors";

const items: DrawerMenuItem[] = [
  { label: "Início", route: "/flanelinha/home" },
  { label: "Solicitar Carteirinha Nova", route: "/flanelinha/solicitar-carteirinha" },
];

export default function FlanelinhaLayout() {
  return (
    <Drawer
      drawerContent={() => <DrawerContent items={items} />}
      screenOptions={{ headerTintColor: colors.primary }}
    >
      <Drawer.Screen name="home" options={{ title: "Início" }} />
      <Drawer.Screen name="solicitar-carteirinha" options={{ title: "Solicitar Carteirinha" }} />
    </Drawer>
  );
}
