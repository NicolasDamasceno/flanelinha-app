import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text } from "react-native";
import { changePassword } from "@/api/auth";
import { extractErrorMessage } from "@/api/client";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAuth } from "@/context/AuthContext";
import { colors } from "@/theme/colors";
import type { FlanelinhaPerfil } from "@/types/auth";

export default function AlterarSenhaScreen() {
  const { session, logout } = useAuth();

  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!session) {
      return;
    }

    const novaSenhaValue = novaSenha.trim();
    const confirmarSenhaValue = confirmarSenha.trim();

    if (!novaSenhaValue || !confirmarSenhaValue) {
      setErrorMessage("Preencha todos os campos");
      return;
    }

    if (novaSenhaValue !== confirmarSenhaValue) {
      setErrorMessage("As senhas não coincidem");
      return;
    }

    if (novaSenhaValue.length < 6) {
      setErrorMessage("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      // Esta tela só é alcançada a partir do login de um Flanelinha em primeiro acesso
      // (app/(auth)/login.tsx), então session.perfil é sempre um FlanelinhaPerfil aqui.
      const { idFlanel } = session.perfil as FlanelinhaPerfil;
      await changePassword(idFlanel, novaSenhaValue);
      await logout({ senhaAlterada: "1" });
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <Text style={styles.title}>Alterar Senha</Text>
      <Text style={styles.subtitle}>
        Este é seu primeiro acesso. Defina uma nova senha para continuar.
      </Text>

      {errorMessage ? <Banner type="error" message={errorMessage} /> : null}

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

      <Button label="Salvar" onPress={handleSubmit} loading={isSubmitting} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 24,
  },
});
