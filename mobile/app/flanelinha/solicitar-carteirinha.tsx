import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { getMyFlanelinha, requestCarteira } from "@/api/flanelinha";
import { extractErrorMessage } from "@/api/client";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { useAuth } from "@/context/AuthContext";
import { colors } from "@/theme/colors";
import type { FlanelinhaPerfil } from "@/types/auth";
import type { CarterinhaDto } from "@/types/flanelinha";
import { formatDate, getCarteiraAtual, isCarteiraVencida } from "@/utils/carteira";

export default function SolicitarCarteirinhaScreen() {
  const { session } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [carteiraAtual, setCarteiraAtual] = useState<CarterinhaDto | null>(null);

  const [requestError, setRequestError] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setIsLoading(true);
      setLoadError(null);
      setRequestError(null);

      getMyFlanelinha()
        .then((data) => {
          if (cancelled) return;
          setCarteiraAtual(getCarteiraAtual(data.carterinhas));
        })
        .catch((error) => {
          if (!cancelled) setLoadError(extractErrorMessage(error));
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }, [])
  );

  async function handleSolicitar() {
    if (!session) return;
    const idFlanel = (session.perfil as FlanelinhaPerfil).idFlanel;

    setRequestError(null);
    setIsRequesting(true);

    try {
      await requestCarteira(idFlanel);
      router.replace("/flanelinha/home");
    } catch (error) {
      setRequestError(extractErrorMessage(error));
    } finally {
      setIsRequesting(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.container}>
        <Banner type="error" message={loadError} />
      </View>
    );
  }

  const bloqueado = carteiraAtual != null && !isCarteiraVencida(carteiraAtual);

  return (
    <View style={styles.container}>
      {requestError ? <Banner type="error" message={requestError} /> : null}

      {bloqueado && carteiraAtual ? (
        <>
          <Text style={styles.label}>Sua carteirinha atual:</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Número</Text>
              <Text style={styles.summaryValue}>
                #{String(carteiraAtual.numeroCarterinha).padStart(6, "0")}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Validade</Text>
              <Text style={styles.summaryValue}>{formatDate(carteiraAtual.dataValidade)}</Text>
            </View>
          </View>
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              Sua carteira atual ainda é válida até {formatDate(carteiraAtual.dataValidade)}. Não é
              possível solicitar uma nova até o vencimento.
            </Text>
          </View>
        </>
      ) : null}

      <Button
        label="Solicitar Nova Via"
        onPress={handleSolicitar}
        loading={isRequesting}
        disabled={bloqueado}
      />
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
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 8,
  },
  summaryCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  summaryValue: {
    fontSize: 12,
    color: colors.text,
    fontWeight: "600",
  },
  warningBox: {
    backgroundColor: colors.warningBackground,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    marginBottom: 16,
  },
  warningText: {
    color: colors.warning,
    fontSize: 13,
  },
});
