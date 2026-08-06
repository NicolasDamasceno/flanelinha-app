import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from "react-native";
import { changeFlanelinhaPassword, updatePerfilFlanelinha } from "@/api/flanelinha";
import { extractErrorMessage } from "@/api/client";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAuth } from "@/context/AuthContext";
import { colors } from "@/theme/colors";
import type { FlanelinhaPerfil } from "@/types/auth";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function FlanelinhaAtualizarDadosScreen() {
  const { session, updateProfile } = useAuth();
  // Optional, not cast to a definite FlanelinhaPerfil: same rationale as fiscal/perfil.tsx — this
  // screen stays mounted while the Drawer is alive, and logout() clears the session synchronously
  // before navigating away, so a re-render with session === null is expected here too.
  const perfil = session?.perfil as FlanelinhaPerfil | undefined;

  const [nome, setNome] = useState(perfil?.nome ?? "");
  const [email, setEmail] = useState(perfil?.email ?? "");
  const [dadosError, setDadosError] = useState<{ text: string } | null>(null);
  const [dadosSuccess, setDadosSuccess] = useState<{ text: string } | null>(null);
  const [isSavingDados, setIsSavingDados] = useState(false);

  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [senhaError, setSenhaError] = useState<{ text: string } | null>(null);
  const [senhaSuccess, setSenhaSuccess] = useState<{ text: string } | null>(null);
  const [isSavingSenha, setIsSavingSenha] = useState(false);

  useEffect(() => {
    if (!dadosError) return;
    const timer = setTimeout(() => setDadosError(null), 3000);
    return () => clearTimeout(timer);
  }, [dadosError]);

  useEffect(() => {
    if (!dadosSuccess) return;
    const timer = setTimeout(() => setDadosSuccess(null), 3000);
    return () => clearTimeout(timer);
  }, [dadosSuccess]);

  useEffect(() => {
    if (!senhaError) return;
    const timer = setTimeout(() => setSenhaError(null), 3000);
    return () => clearTimeout(timer);
  }, [senhaError]);

  useEffect(() => {
    if (!senhaSuccess) return;
    const timer = setTimeout(() => setSenhaSuccess(null), 3000);
    return () => clearTimeout(timer);
  }, [senhaSuccess]);

  async function handleSaveDados() {
    if (!perfil) return;

    setDadosSuccess(null);

    const nomeValue = nome.trim();
    const emailValue = email.trim();

    if (!nomeValue || !emailValue) {
      setDadosError({ text: "Preencha todos os campos" });
      return;
    }

    if (!EMAIL_PATTERN.test(emailValue)) {
      setDadosError({ text: "Email inválido" });
      return;
    }

    setDadosError(null);
    setIsSavingDados(true);

    try {
      const updated = await updatePerfilFlanelinha(perfil.idFlanel, {
        nome: nomeValue,
        email: emailValue,
      });
      setDadosSuccess({ text: "Dados atualizados com sucesso." });
      try {
        await updateProfile(updated);
      } catch {
        // Persistência local da sessão falhou; a sessão em memória já foi atualizada e o backend
        // já gravou — não é um erro do ponto de vista do usuário.
      }
    } catch (error) {
      setDadosError({ text: extractErrorMessage(error) });
    } finally {
      setIsSavingDados(false);
    }
  }

  async function handleChangePassword() {
    if (!perfil) return;

    setSenhaSuccess(null);

    const senhaAtualValue = senhaAtual.trim();
    const novaSenhaValue = novaSenha.trim();
    const confirmarSenhaValue = confirmarSenha.trim();

    if (!senhaAtualValue || !novaSenhaValue || !confirmarSenhaValue) {
      setSenhaError({ text: "Preencha todos os campos" });
      return;
    }

    if (novaSenhaValue !== confirmarSenhaValue) {
      setSenhaError({ text: "As senhas não coincidem" });
      return;
    }

    if (novaSenhaValue.length < 6) {
      setSenhaError({ text: "A senha deve ter no mínimo 6 caracteres." });
      return;
    }

    setSenhaError(null);
    setIsSavingSenha(true);

    try {
      await changeFlanelinhaPassword(perfil.idFlanel, senhaAtualValue, novaSenhaValue);
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarSenha("");
      setSenhaSuccess({ text: "Senha alterada com sucesso." });
    } catch (error) {
      setSenhaError({ text: extractErrorMessage(error) });
    } finally {
      setIsSavingSenha(false);
    }
  }

  if (!perfil) {
    return null;
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {dadosError ? <Banner type="error" message={dadosError.text} /> : null}
        {dadosSuccess ? <Banner type="success" message={dadosSuccess.text} /> : null}

        <Input label="Nome" value={nome} onChangeText={setNome} />
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Button label="Salvar Dados" onPress={handleSaveDados} loading={isSavingDados} />

        <Text style={styles.sectionTitle}>Trocar Senha</Text>

        {senhaError ? <Banner type="error" message={senhaError.text} /> : null}
        {senhaSuccess ? <Banner type="success" message={senhaSuccess.text} /> : null}

        <Input
          label="Senha Atual"
          value={senhaAtual}
          onChangeText={setSenhaAtual}
          secureTextEntry
          textContentType="password"
          autoComplete="password"
        />
        <Input
          label="Nova Senha"
          value={novaSenha}
          onChangeText={setNovaSenha}
          secureTextEntry
          textContentType="newPassword"
          autoComplete="new-password"
        />
        <Input
          label="Confirmar Nova Senha"
          value={confirmarSenha}
          onChangeText={setConfirmarSenha}
          secureTextEntry
          textContentType="newPassword"
          autoComplete="new-password"
        />
        <Button label="Trocar Senha" onPress={handleChangePassword} loading={isSavingSenha} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 20,
    paddingTop: 16,
    marginBottom: 4,
  },
});
