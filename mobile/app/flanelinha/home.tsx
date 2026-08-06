import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { getMyFlanelinha } from "@/api/flanelinha";
import { extractErrorMessage } from "@/api/client";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { QrCode } from "@/components/QrCode";
import { colors } from "@/theme/colors";
import type { CarterinhaDto } from "@/types/flanelinha";
import { formatDate, getCarteiraAtual, isCarteiraVencida } from "@/utils/carteira";

export default function FlanelinhaHomeScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pontoAtuacao, setPontoAtuacao] = useState("");
  const [carteiraAtual, setCarteiraAtual] = useState<CarterinhaDto | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setIsLoading(true);
      setErrorMessage(null);

      getMyFlanelinha()
        .then((data) => {
          if (cancelled) return;
          setPontoAtuacao(data.pontoAtuacao);
          setCarteiraAtual(getCarteiraAtual(data.carterinhas));
        })
        .catch((error) => {
          if (!cancelled) setErrorMessage(extractErrorMessage(error));
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });

      return () => {
        cancelled = true;
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

  if (!carteiraAtual) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Você ainda não tem uma carteirinha</Text>
          <Text style={styles.emptyText}>
            Solicite sua primeira via para começar a usar a carteira digital.
          </Text>
        </View>
        <Button
          label="Solicitar Carteirinha"
          onPress={() => router.push("/flanelinha/solicitar-carteirinha")}
        />
      </View>
    );
  }

  const vencida = isCarteiraVencida(carteiraAtual);

  return (
    <View style={styles.container}>
      <View style={[styles.card, vencida && styles.cardVencida]}>
        <Text style={styles.cardTitle}>Carteirinha de Flanelinha</Text>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Número</Text>
          <Text style={styles.cardValue}>
            #{String(carteiraAtual.numeroCarterinha).padStart(6, "0")}
          </Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Ponto de Atuação</Text>
          <Text style={styles.cardValue}>{pontoAtuacao}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Validade</Text>
          <Text style={styles.cardValue}>{formatDate(carteiraAtual.dataValidade)}</Text>
        </View>
        <View style={styles.cardFooter}>
          <View
            style={[
              styles.badge,
              { backgroundColor: vencida ? colors.errorBackground : colors.successBackground },
            ]}
          >
            <Text
              style={{
                color: vencida ? colors.error : colors.success,
                fontSize: 11,
                fontWeight: "700",
              }}
            >
              {vencida ? "Vencida" : "Ativa"}
            </Text>
          </View>
          <View style={vencida ? styles.qrDimmed : undefined}>
            <QrCode value={String(carteiraAtual.numeroCarterinha)} size={64} />
          </View>
        </View>
      </View>
      {vencida ? (
        <Button
          label="Solicitar Renovação"
          onPress={() => router.push("/flanelinha/solicitar-carteirinha")}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontWeight: "700",
    color: colors.text,
    marginBottom: 6,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: 20,
  },
  card: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 14,
    padding: 18,
    backgroundColor: colors.background,
    marginBottom: 16,
  },
  cardVencida: {
    borderColor: colors.error,
  },
  cardTitle: {
    fontSize: 11,
    letterSpacing: 1,
    color: colors.textMuted,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  cardLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  cardValue: {
    fontSize: 12,
    color: colors.text,
    fontWeight: "600",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderStyle: "dashed",
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  qrDimmed: {
    opacity: 0.3,
  },
});
