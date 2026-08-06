import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

export type PhotoSource = "camera" | "gallery";

export async function pickAndCompressPhoto(source: PhotoSource): Promise<string | null> {
  const permission =
    source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error(
      source === "camera"
        ? "Permissão de câmera negada. Habilite o acesso à câmera nas configurações do app."
        : "Permissão de galeria negada. Habilite o acesso às fotos nas configurações do app."
    );
  }

  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({ quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 1 });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  // manipulateAsync (a função solta, pré-SDK 52) está deprecated no expo-image-manipulator
  // instalado (57.0.8) em favor desta API encadeável — ainda funcionaria, mas usar a atual evita
  // um aviso de depreciação logo na primeira versão deste código.
  //
  // resize() só preserva a proporção da imagem quando recebe UMA dimensão (a outra é calculada
  // automaticamente) — passar width e height juntos força esse tamanho exato e distorce fotos que
  // não são quadradas. Por isso só a maior dimensão da foto original é restringida a 480px.
  const asset = result.assets[0];
  const resizeOptions = asset.width >= asset.height ? { width: 480 } : { height: 480 };

  const context = ImageManipulator.manipulate(asset.uri);
  const renderedImage = await context.resize(resizeOptions).renderAsync();
  const manipulated = await renderedImage.saveAsync({
    base64: true,
    compress: 0.6,
    format: SaveFormat.JPEG,
  });

  if (!manipulated.base64) {
    throw new Error("Não foi possível processar a foto. Tente novamente.");
  }

  return manipulated.base64;
}
