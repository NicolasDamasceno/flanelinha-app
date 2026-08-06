import { router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { getMyFlanelinha } from "@/api/flanelinha";
import { extractErrorMessage } from "@/api/client";
import { Avatar } from "@/components/Avatar";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { QrCode } from "@/components/QrCode";
import { colors } from "@/theme/colors";
import type { CarterinhaDto } from "@/types/flanelinha";
import { formatDate, formatNumeroCarteira, getCarteiraAtual, isCarteiraVencida } from "@/utils/carteira";
import { exportCarteiraPdf } from "@/utils/pdf";

type SuccessParams = { carteiraEmitida?: string };

export default function FlanelinhaHomeScreen() {
  const navigation = useNavigation<{ setParams: (params: SuccessParams) => void }>();
  const params = useLocalSearchParams<SuccessParams>();

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [pontoAtuacao, setPontoAtuacao] = useState("");
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  const [carteiraAtual, setCarteiraAtual] = useState<CarterinhaDto | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    if (params.carteiraEmitida === "1") {
      setSuccessMessage("Carteirinha emitida com sucesso.");
      navigation.setParams({ carteiraEmitida: undefined });
    }
  }, [params.carteiraEmitida]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setIsLoading(true);
      setErrorMessage(null);

      getMyFlanelinha()
        .then((data) => {
          if (cancelled) return;
          setNome(data.nome);
          setCpf(data.cpf);
          setPontoAtuacao(data.pontoAtuacao);
          setFotoBase64(data.fotoBase64);
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
        setSuccessMessage(null);
      };
    }, [])
  );

  async function handleExportPdf() {
    if (!carteiraAtual) return;

    setExportError(null);
    setIsExporting(true);

    try {
      await exportCarteiraPdf({ nome, cpf, pontoAtuacao, fotoBase64, carteira: carteiraAtual });
    } catch (error) {
      setExportError(extractErrorMessage(error));
    } finally {
      setIsExporting(false);
    }
  }

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
        {successMessage ? <Banner type="success" message={successMessage} /> : null}
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
      {successMessage ? <Banner type="success" message={successMessage} /> : null}
      {exportError ? <Banner type="error" message={exportError} /> : null}
      <View style={[styles.card, vencida && styles.cardVencida]}>
        <Text style={styles.cardTitle}>Carteirinha de Flanelinha</Text>
        <View style={styles.cardAvatarRow}>
          <Avatar base64={fotoBase64} size={72} />
        </View>
        <Text style={styles.cardName}>{nome}</Text>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Número</Text>
          <Text style={styles.cardValue}>{formatNumeroCarteira(carteiraAtual.numeroCarterinha)}</Text>
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
            <QrCode value={String(carteiraAtual.numeroCarterinha)} size={96} />
          </View>
        </View>
      </View>
      {vencida ? (
        <Button
          label="Solicitar Renovação"
          onPress={() => router.push("/flanelinha/solicitar-carteirinha")}
        />
      ) : null}
      <View style={styles.exportButtonSpacing}>
        <Button label="Exportar PDF" variant="secondary" onPress={handleExportPdf} loading={isExporting} />
      </View>
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
  cardAvatarRow: {
    alignItems: "center",
    marginTop: 8,
  },
  cardName: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginTop: 8,
    textAlign: "center",
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
  exportButtonSpacing: {
    marginTop: 12,
  },
});
