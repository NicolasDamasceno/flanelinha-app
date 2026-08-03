import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
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

    if (!cpf.trim() || !senha.trim()) {
      setErrorMessage("Preencha todos os campos");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await login(cpf, senha);

      if (response.tipoPerfil === "Flanelinha" && response.primeiroAcesso) {
        router.replace("/alterar-senha");
        return;
      }

      router.replace(response.tipoPerfil === "Fiscal" ? "/fiscal/home" : "/flanelinha/home");
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Entrar</Text>

      {errorMessage ? <Banner type="error" message={errorMessage} /> : null}
      {successMessage ? <Banner type="success" message={successMessage} /> : null}

      <Input label="CPF" value={cpf} onChangeText={setCpf} keyboardType="numeric" />
      <Input label="Senha" value={senha} onChangeText={setSenha} secureTextEntry />

      <Button label="Entrar" onPress={handleSubmit} loading={isSubmitting} />
    </View>
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
    marginBottom: 24,
  },
});
