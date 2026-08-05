import { router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { listFlanelinhas } from "@/api/flanelinha";
import { extractErrorMessage } from "@/api/client";
import { Banner } from "@/components/Banner";
import { colors } from "@/theme/colors";
import type { FlanelinhaDto } from "@/types/flanelinha";

const SUCCESS_MESSAGES: Record<string, string> = {
  cadastroSucesso: "Flanelinha cadastrado com sucesso.",
  edicaoSucesso: "Alterações salvas com sucesso.",
  exclusaoSucesso: "Flanelinha excluído com sucesso.",
};

type SuccessParams = {
  cadastroSucesso?: string;
  edicaoSucesso?: string;
  exclusaoSucesso?: string;
};

export default function FlanelinhasScreen() {
  const navigation = useNavigation<{ setParams: (params: SuccessParams) => void }>();
  const params = useLocalSearchParams<SuccessParams>();

  const [flanelinhas, setFlanelinhas] = useState<FlanelinhaDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Drawer keeps this screen mounted, so the banner must be cleared on blur (below) AND the
  // route param cleared here — the param clearing is what lets a *second* create re-fire this
  // effect, the blur clearing is what stops a stale banner reappearing on back-navigation or a
  // drawer round-trip. Deps are the three scalar param values, not `params` itself, since
  // useLocalSearchParams() returns a new object on every render.
  useEffect(() => {
    const key = (["cadastroSucesso", "edicaoSucesso", "exclusaoSucesso"] as const).find(
      (k) => params[k] === "1"
    );
    if (key) {
      setSuccessMessage(SUCCESS_MESSAGES[key]);
      navigation.setParams({ [key]: undefined });
    }
  }, [params.cadastroSucesso, params.edicaoSucesso, params.exclusaoSucesso]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setIsLoading(true);
      setErrorMessage(null);

      listFlanelinhas()
        .then((data) => {
          if (!cancelled) setFlanelinhas(data);
        })
        .catch((error) => {
          if (!cancelled) setErrorMessage(extractErrorMessage(error));
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });

      return () => {
        cancelled = true;
        setSuccessMessage(null);
      };
    }, [])
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={styles.container}>
        <Banner type="error" message={errorMessage} />
      </View>
    );
  }

  return (
    <FlatList
      data={flanelinhas}
      keyExtractor={(item) => String(item.idFlanel)}
      contentContainerStyle={styles.container}
      ListHeaderComponent={
        successMessage ? <Banner type="success" message={successMessage} /> : null
      }
      ListEmptyComponent={
        <Text style={styles.emptyText}>Nenhum Flanelinha cadastrado ainda.</Text>
      }
      renderItem={({ item }) => (
        <Pressable
          style={styles.card}
          onPress={() => router.push(`/fiscal/flanelinha/${item.idFlanel}`)}
          accessibilityRole="button"
        >
          <Text style={styles.cardName}>{item.nome}</Text>
          <Text style={styles.cardSubtitle}>{item.pontoAtuacao}</Text>
          <View
            style={[
              styles.badge,
              { backgroundColor: item.ativo ? colors.successBackground : colors.errorBackground },
            ]}
          >
            <Text style={{ color: item.ativo ? colors.success : colors.error, fontSize: 11, fontWeight: "600" }}>
              {item.ativo ? "Ativo" : "Inativo"}
            </Text>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 24,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  cardName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 6,
  },
});
