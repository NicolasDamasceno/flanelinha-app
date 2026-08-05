import { useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { changeFiscalPassword, updateFiscalPerfil } from "@/api/fiscal";
import { extractErrorMessage } from "@/api/client";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAuth } from "@/context/AuthContext";
import { colors } from "@/theme/colors";
import type { FiscalPerfil } from "@/types/auth";

export default function FiscalPerfilScreen() {
  const { session, updateProfile } = useAuth();
  // Optional, not cast to a definite FiscalPerfil: this screen stays mounted while the Drawer is
  // alive, and it's the screen the "Sair" verification step actually logs out from (Task 9) —
  // logout() clears the session synchronously before navigating away, so a re-render with
  // session === null is not just possible here, it's the expected path. useState below only
  // needs perfil's fields for their *initial* mount-time value, so a safe fallback is enough;
  // the render guard further down handles everything after mount.
  const perfil = session?.perfil as FiscalPerfil | undefined;

  const [nome, setNome] = useState(perfil?.nome ?? "");
  const [email, setEmail] = useState(perfil?.email ?? "");
  const [dadosError, setDadosError] = useState<string | null>(null);
  const [dadosSuccess, setDadosSuccess] = useState<string | null>(null);
  const [isSavingDados, setIsSavingDados] = useState(false);

  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [senhaError, setSenhaError] = useState<string | null>(null);
  const [senhaSuccess, setSenhaSuccess] = useState<string | null>(null);
  const [isSavingSenha, setIsSavingSenha] = useState(false);

  async function handleSaveDados() {
    if (!perfil) return;

    setDadosSuccess(null);

    const nomeValue = nome.trim();
    const emailValue = email.trim();

    if (!nomeValue || !emailValue) {
      setDadosError("Preencha todos os campos");
      return;
    }

    setDadosError(null);
    setIsSavingDados(true);

    try {
      const updated = await updateFiscalPerfil(perfil.idFiscal, { nome: nomeValue, email: emailValue });
      setDadosSuccess("Dados atualizados com sucesso.");
      try {
        await updateProfile(updated);
      } catch {
        // Persistência local da sessão falhou; a sessão em memória já foi atualizada e o backend
        // já gravou — não é um erro do ponto de vista do usuário.
      }
    } catch (error) {
      setDadosError(extractErrorMessage(error));
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
      setSenhaError("Preencha todos os campos");
      return;
    }

    if (novaSenhaValue !== confirmarSenhaValue) {
      setSenhaError("As senhas não coincidem");
      return;
    }

    setSenhaError(null);
    setIsSavingSenha(true);

    try {
      await changeFiscalPassword(perfil.idFiscal, senhaAtualValue, novaSenhaValue);
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarSenha("");
      setSenhaSuccess("Senha alterada com sucesso.");
    } catch (error) {
      setSenhaError(extractErrorMessage(error));
    } finally {
      setIsSavingSenha(false);
    }
  }

  if (!perfil) {
    return null;
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      {dadosError ? <Banner type="error" message={dadosError} /> : null}
      {dadosSuccess ? <Banner type="success" message={dadosSuccess} /> : null}

      <Input label="Nome" value={nome} onChangeText={setNome} />
      <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Button label="Salvar Dados" onPress={handleSaveDados} loading={isSavingDados} />

      <Text style={styles.sectionTitle}>Trocar Senha</Text>

      {senhaError ? <Banner type="error" message={senhaError} /> : null}
      {senhaSuccess ? <Banner type="success" message={senhaSuccess} /> : null}

      <Input label="Senha Atual" value={senhaAtual} onChangeText={setSenhaAtual} secureTextEntry textContentType="password" autoComplete="password" />
      <Input label="Nova Senha" value={novaSenha} onChangeText={setNovaSenha} secureTextEntry textContentType="newPassword" autoComplete="new-password" />
      <Input label="Confirmar Nova Senha" value={confirmarSenha} onChangeText={setConfirmarSenha} secureTextEntry textContentType="newPassword" autoComplete="new-password" />
      <Button label="Trocar Senha" onPress={handleChangePassword} loading={isSavingSenha} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
