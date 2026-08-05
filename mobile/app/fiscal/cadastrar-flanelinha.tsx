import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { createFlanelinha } from "@/api/flanelinha";
import { extractErrorMessage } from "@/api/client";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";

export default function CadastrarFlanelinhaScreen() {
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [pontoAtuacao, setPontoAtuacao] = useState("");
  const [telefone, setTelefone] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    const nomeValue = nome.trim();
    const cpfValue = cpf.trim().replace(/\D/g, "");
    const emailValue = email.trim();
    const pontoAtuacaoValue = pontoAtuacao.trim();
    const telefoneValue = telefone.trim();

    if (!nomeValue || !cpfValue || !emailValue || !pontoAtuacaoValue || !telefoneValue) {
      setErrorMessage("Preencha todos os campos");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await createFlanelinha({
        nome: nomeValue,
        cpf: cpfValue,
        email: emailValue,
        pontoAtuacao: pontoAtuacaoValue,
        telefone: telefoneValue,
      });
      router.replace({ pathname: "/fiscal/flanelinhas", params: { cadastroSucesso: "1" } });
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {errorMessage ? <Banner type="error" message={errorMessage} /> : null}

      <Input label="Nome" value={nome} onChangeText={setNome} />
      <Input
        label="CPF"
        value={cpf}
        onChangeText={setCpf}
        keyboardType="number-pad"
        maxLength={11}
      />
      <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Input label="Ponto de Atuação" value={pontoAtuacao} onChangeText={setPontoAtuacao} />
      <Input label="Telefone" value={telefone} onChangeText={setTelefone} keyboardType="phone-pad" />

      <Button label="Cadastrar" onPress={handleSubmit} loading={isSubmitting} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
  },
});
