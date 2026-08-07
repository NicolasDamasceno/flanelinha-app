import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, StyleSheet, Text } from "react-native";
import { extractErrorMessage } from "@/api/client";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAuth } from "@/context/AuthContext";

export default function LoginScreen() {
  const { login } = useAuth();
  const params = useLocalSearchParams<{ senhaAlterada?: string }>();

  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(
    params.senhaAlterada === "1" ? "Senha alterada com sucesso. Faça login novamente." : null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setSuccessMessage(null);

    const cpfValue = cpf.trim();
    const senhaValue = senha.trim();

    if (!cpfValue || !senhaValue) {
      setErrorMessage("Preencha todos os campos");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await login(cpfValue.replace(/\D/g, ""), senhaValue);

      if (response.tipoPerfil === "Flanelinha" && response.primeiroAcesso) {
        router.replace("/alterar-senha");
        return;
      }

      router.replace(response.tipoPerfil === "Fiscal" ? "/fiscal/home" : "/flanelinha/home");
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      // Unlike Alterar Senha, login's most common outcome is the error path, which needs the
      // reset — so resetting unconditionally here (even on the success path, briefly, before
      // navigation completes) is the right call for this screen.
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <Image source={require("../../assets/logo-pmt-login.png")} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>Entrar</Text>

      {errorMessage ? <Banner type="error" message={errorMessage} /> : null}
      {successMessage ? <Banner type="success" message={successMessage} /> : null}

      <Input
        label="CPF"
        value={cpf}
        onChangeText={setCpf}
        keyboardType="number-pad"
        maxLength={11}
        textContentType="username"
        autoComplete="username"
      />
      <Input
        label="Senha"
        value={senha}
        onChangeText={setSenha}
        secureTextEntry
        textContentType="password"
        autoComplete="password"
      />

      <Button label="Entrar" onPress={handleSubmit} loading={isSubmitting} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  logo: {
    width: 220,
    height: 120,
    alignSelf: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 24,
  },
});
