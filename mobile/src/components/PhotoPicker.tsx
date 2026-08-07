import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text } from "react-native";
import { pickAndCompressPhoto } from "@/utils/photo";
import { DisplayableError } from "@/api/client";
import { Avatar } from "@/components/Avatar";
import { colors } from "@/theme/colors";

interface PhotoPickerProps {
  value: string | null;
  onChange: (base64: string) => void;
  onError: (message: string) => void;
}

/**
 * Renderiza um Fragment (sem elemento raiz) — o Avatar e o botão são filhos flex diretos do
 * container do chamador. Por isso o próprio PhotoPicker não se centraliza: quem usa este
 * componente precisa fornecer um View com `alignItems: "center"` ao redor dele (ver `photoRow`
 * em cadastrar-flanelinha.tsx e flanelinha/[id].tsx) e qualquer espaçamento inferior desejado —
 * o componente só é responsável pelo espaço entre o avatar e o próprio botão.
 */
export function PhotoPicker({ value, onChange, onError }: PhotoPickerProps) {
  const [isPicking, setIsPicking] = useState(false);

  function handlePress() {
    Alert.alert("Foto do Flanelinha", undefined, [
      { text: "Tirar Foto", onPress: () => runPick("camera") },
      { text: "Escolher da Galeria", onPress: () => runPick("gallery") },
      { text: "Cancelar", style: "cancel" },
    ]);
  }

  async function runPick(source: "camera" | "gallery") {
    setIsPicking(true);
    try {
      const base64 = await pickAndCompressPhoto(source);
      if (base64) onChange(base64);
    } catch (error) {
      onError(error instanceof DisplayableError ? error.message : "Não foi possível obter a foto.");
    } finally {
      setIsPicking(false);
    }
  }

  return (
    <>
      <Avatar base64={value} size={96} />
      <Pressable
        onPress={handlePress}
        disabled={isPicking}
        accessibilityRole="button"
        accessibilityState={{ disabled: isPicking, busy: isPicking }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.button}
      >
        {isPicking ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : (
          <Text style={styles.buttonText}>{value ? "Trocar Foto" : "Adicionar Foto"}</Text>
        )}
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  buttonText: {
    color: colors.primary,
    fontWeight: "600",
    fontSize: 13,
  },
});
