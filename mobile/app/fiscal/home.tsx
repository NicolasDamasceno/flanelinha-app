import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { listFlanelinhas } from "@/api/flanelinha";
import { extractErrorMessage } from "@/api/client";
import { Banner } from "@/components/Banner";
import { useAuth } from "@/context/AuthContext";
import { colors } from "@/theme/colors";
import type { FiscalPerfil } from "@/types/auth";

export default function FiscalHomeScreen() {
  const { session } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [ativos, setAtivos] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setIsLoading(true);
      setErrorMessage(null);

      listFlanelinhas()
        .then((flanelinhas) => {
          if (cancelled) return;
          setTotal(flanelinhas.length);
          setAtivos(flanelinhas.filter((f) => f.ativo).length);
        })
        .catch((error) => {
          if (cancelled) return;
          setErrorMessage(extractErrorMessage(error));
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }, [])
  );

  if (!session) {
    // Home stays mounted while the Drawer is alive, and logout() clears the session
    // synchronously before the navigation to /login actually completes — so this screen can
    // briefly re-render with session === null. Bail out rather than crash on session.perfil.
    return null;
  }

  const perfil = session.perfil as FiscalPerfil;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Olá, {perfil.nome}</Text>
      <Text style={styles.subtitle}>Bem-vindo de volta</Text>

      {errorMessage ? <Banner type="error" message={errorMessage} /> : null}

      {isLoading ? (
        <ActivityIndicator style={styles.loading} color={colors.primary} />
      ) : errorMessage ? null : (
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{total}</Text>
            <Text style={styles.statLabel}>Flanelinhas cadastrados</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{ativos}</Text>
            <Text style={styles.statLabel}>Ativos</Text>
          </View>
        </View>
      )}

      <Image source={require("../../assets/logo-home.png")} style={styles.logo} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: 16,
  },
  loading: {
    marginTop: 24,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  statBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.primary,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: "center",
  },
  logo: {
    width: 72,
    height: 72,
    alignSelf: "center",
    marginTop: "auto",
  },
});
