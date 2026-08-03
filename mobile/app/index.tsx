import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { colors } from "@/theme/colors";

export default function Index() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  return <Redirect href={session.tipoPerfil === "Fiscal" ? "/fiscal/home" : "/flanelinha/home"} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
