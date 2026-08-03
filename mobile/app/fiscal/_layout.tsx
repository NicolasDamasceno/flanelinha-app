import { Drawer } from "expo-router/drawer";
import { DrawerContent, type DrawerMenuItem } from "@/components/DrawerContent";

const items: DrawerMenuItem[] = [
  { label: "Início", route: "/fiscal/home" },
  { label: "Cadastrar Flanelinha", route: "/fiscal/cadastrar-flanelinha" },
  { label: "Visualizar Flanelinhas", route: "/fiscal/flanelinhas" },
  { label: "Atualizar Dados", route: "/fiscal/perfil" },
];

export default function FiscalLayout() {
  return (
    <Drawer drawerContent={() => <DrawerContent items={items} />}>
      <Drawer.Screen name="home" options={{ title: "Início" }} />
      <Drawer.Screen name="cadastrar-flanelinha" options={{ title: "Cadastrar Flanelinha" }} />
      <Drawer.Screen name="flanelinhas" options={{ title: "Flanelinhas" }} />
      <Drawer.Screen name="perfil" options={{ title: "Meus Dados" }} />
    </Drawer>
  );
}
