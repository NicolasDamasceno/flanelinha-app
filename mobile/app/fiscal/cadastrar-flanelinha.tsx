import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { createFlanelinha } from "@/api/flanelinha";
import { extractErrorMessage } from "@/api/client";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { PhotoPicker } from "@/components/PhotoPicker";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function CadastrarFlanelinhaScreen() {
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [pontoAtuacao, setPontoAtuacao] = useState("");
  const [telefone, setTelefone] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // A Drawer mantém esta tela montada ao trocar de aba, então um erro de uma tentativa
  // anterior ficaria visível indefinidamente sem isso — mesma classe de problema já tratada
  // nas telas de lista/detalhe/home com useFocusEffect, só que aqui não há fetch, só o banner
  // pra limpar ao perder o foco.
  useFocusEffect(
    useCallback(() => {
      return () => setErrorMessage(null);
    }, [])
  );

  async function handleSubmit() {
    const nomeValue = nome.trim();
    const cpfValue = cpf.trim().replace(/\D/g, "");
    const emailValue = email.trim();
    const pontoAtuacaoValue = pontoAtuacao.trim();
    const telefoneValue = telefone.trim().replace(/\D/g, "");

    if (!nomeValue || !cpfValue || !emailValue || !pontoAtuacaoValue || !telefoneValue) {
      setErrorMessage("Preencha todos os campos");
      return;
    }

    if (cpfValue.length !== 11) {
      setErrorMessage("CPF inválido");
      return;
    }

    if (!EMAIL_PATTERN.test(emailValue)) {
      setErrorMessage("Email inválido");
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
        fotoBase64,
      });
      setFotoBase64(null);
      setNome("");
      setCpf("");
      setEmail("");
      setPontoAtuacao("");
      setTelefone("");
      router.replace({ pathname: "/fiscal/flanelinhas", params: { cadastroSucesso: "1" } });
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      {errorMessage ? <Banner type="error" message={errorMessage} /> : null}

      <View style={styles.photoRow}>
        <PhotoPicker
          value={fotoBase64}
          onChange={(base64) => {
            setFotoBase64(base64);
            setErrorMessage(null);
          }}
          onError={setErrorMessage}
        />
      </View>

      <Input label="Nome" value={nome} onChangeText={setNome} />
      <Input
        label="CPF"
        value={cpf}
        onChangeText={(text) => setCpf(text.replace(/\D/g, "").slice(0, 11))}
        keyboardType="number-pad"
      />
      <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Input label="Ponto de Atuação" value={pontoAtuacao} onChangeText={setPontoAtuacao} />
      <Input
        label="Telefone"
        value={telefone}
        onChangeText={(text) => setTelefone(text.replace(/\D/g, "").slice(0, 11))}
        keyboardType="phone-pad"
      />

      <Button label="Cadastrar" onPress={handleSubmit} loading={isSubmitting} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
  },
  photoRow: {
    alignItems: "center",
    marginBottom: 16,
  },
});
