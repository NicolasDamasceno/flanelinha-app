import { router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { deleteFlanelinha, getFlanelinha, updateFlanelinha } from "@/api/flanelinha";
import { extractErrorMessage } from "@/api/client";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { colors } from "@/theme/colors";

export default function FlanelinhaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const flanelId = Number(id);
  const navigation = useNavigation();

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [cpf, setCpf] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [pontoAtuacao, setPontoAtuacao] = useState("");
  const [telefone, setTelefone] = useState("");
  const [ativo, setAtivo] = useState(true);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!Number.isInteger(flanelId) || flanelId <= 0) {
        setLoadError("Flanelinha inválido.");
        setIsLoading(false);
        return;
      }

      let cancelled = false;
      setIsLoading(true);
      setLoadError(null);

      getFlanelinha(flanelId)
        .then((data) => {
          if (cancelled) return;
          navigation.setOptions({ title: data.nome });
          setCpf(data.cpf);
          setNome(data.nome);
          setEmail(data.email);
          setPontoAtuacao(data.pontoAtuacao);
          setTelefone(data.telefone);
          setAtivo(data.ativo);
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
    }, [flanelId, navigation])
  );

  async function handleSave() {
    const nomeValue = nome.trim();
    const emailValue = email.trim();
    const pontoAtuacaoValue = pontoAtuacao.trim();
    const telefoneValue = telefone.trim();

    if (!nomeValue || !emailValue || !pontoAtuacaoValue || !telefoneValue) {
      setErrorMessage("Preencha todos os campos");
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      await updateFlanelinha(flanelId, {
        nome: nomeValue,
        email: emailValue,
        pontoAtuacao: pontoAtuacaoValue,
        telefone: telefoneValue,
        ativo,
      });
      router.replace({ pathname: "/fiscal/flanelinhas", params: { edicaoSucesso: "1" } });
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmDelete() {
    setDeleteError(null);
    setIsDeleting(true);

    try {
      await deleteFlanelinha(flanelId);
      setIsModalVisible(false);
      router.replace({ pathname: "/fiscal/flanelinhas", params: { exclusaoSucesso: "1" } });
    } catch (error) {
      setDeleteError(extractErrorMessage(error));
    } finally {
      setIsDeleting(false);
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

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      {errorMessage ? <Banner type="error" message={errorMessage} /> : null}

      <Text style={styles.readonlyLabel}>CPF</Text>
      <Text style={styles.readonlyValue}>{cpf}</Text>

      <Input label="Nome" value={nome} onChangeText={setNome} />
      <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Input label="Ponto de Atuação" value={pontoAtuacao} onChangeText={setPontoAtuacao} />
      <Input label="Telefone" value={telefone} onChangeText={setTelefone} keyboardType="phone-pad" />

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Ativo</Text>
        <Switch value={ativo} onValueChange={setAtivo} trackColor={{ true: colors.success }} />
      </View>

      <Button label="Salvar Alterações" onPress={handleSave} loading={isSaving} disabled={isDeleting} />
      <View style={styles.deleteButtonSpacing}>
        <Button label="Excluir Flanelinha" variant="secondary" onPress={() => setIsModalVisible(true)} disabled={isSaving} />
      </View>

      <Modal
        visible={isModalVisible}
        title="Excluir Flanelinha"
        onClose={() => { setIsModalVisible(false); setDeleteError(null); }}
        actions={
          <>
            <Button label="Cancelar" variant="secondary" onPress={() => { setIsModalVisible(false); setDeleteError(null); }} />
            <Button label="Excluir" onPress={handleConfirmDelete} loading={isDeleting} />
          </>
        }
      >
        {deleteError ? <Banner type="error" message={deleteError} /> : null}
        <Text>Tem certeza que deseja excluir {nome}? Essa ação não pode ser desfeita.</Text>
      </Modal>
    </ScrollView>
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
  readonlyLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 6,
  },
  readonlyValue: {
    fontSize: 16,
    color: colors.textMuted,
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  deleteButtonSpacing: {
    marginTop: 12,
  },
});
