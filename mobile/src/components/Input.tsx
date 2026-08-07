import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors } from "@/theme/colors";

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
}

export function Input({ label, error, style, secureTextEntry, ...rest }: InputProps) {
  const [isVisible, setIsVisible] = useState(false);
  // secureTextEntry só é passado como `true` (nunca `false`) pelos campos de senha do app, então
  // a própria presença da prop é o sinal de que este campo precisa do botão de mostrar/ocultar.
  const isPasswordField = secureTextEntry === true;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrapper}>
        <TextInput
          style={[styles.input, isPasswordField ? styles.inputWithToggle : null, error ? styles.inputError : null, style]}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={label}
          secureTextEntry={isPasswordField ? !isVisible : secureTextEntry}
          {...rest}
        />
        {isPasswordField ? (
          <Pressable
            onPress={() => setIsVisible((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={isVisible ? "Ocultar senha" : "Mostrar senha"}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.toggleButton}
          >
            <Text style={styles.toggleText}>{isVisible ? "🙈" : "👁"}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
    color: colors.text,
  },
  inputWrapper: {
    justifyContent: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
  },
  inputWithToggle: {
    paddingRight: 44,
  },
  inputError: {
    borderColor: colors.error,
  },
  toggleButton: {
    position: "absolute",
    right: 10,
    padding: 4,
  },
  toggleText: {
    fontSize: 18,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    marginTop: 4,
  },
});
