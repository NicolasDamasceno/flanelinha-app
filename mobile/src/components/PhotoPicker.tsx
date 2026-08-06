import { useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { pickAndCompressPhoto } from "@/utils/photo";
import { colors } from "@/theme/colors";

interface PhotoPickerProps {
  value: string | null;
  onChange: (base64: string | null) => void;
  onError: (message: string) => void;
}

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
      onError(error instanceof Error ? error.message : "Não foi possível obter a foto.");
    } finally {
      setIsPicking(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.preview}>
        {value ? (
          <Image source={{ uri: `data:image/jpeg;base64,${value}` }} style={styles.image} />
        ) : (
          <Text style={styles.placeholder}>Sem foto</Text>
        )}
      </View>
      <Pressable onPress={handlePress} disabled={isPicking} style={styles.button}>
        <Text style={styles.buttonText}>{value ? "Trocar Foto" : "Adicionar Foto"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginBottom: 16,
  },
  preview: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 8,
  },
  image: {
    width: 96,
    height: 96,
  },
  placeholder: {
    fontSize: 11,
    color: colors.textMuted,
  },
  button: {
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  buttonText: {
    color: colors.primary,
    fontWeight: "600",
    fontSize: 13,
  },
});
