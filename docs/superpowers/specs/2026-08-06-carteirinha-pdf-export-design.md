# Design: Exportar Carteirinha para PDF (com foto)

## Contexto

Este é o quinto sub-projeto do app Flanelinha, depois dos quatro já mergeados em `main` (auth
backend, scaffold + design system + navegação, fluxo Fiscal, fluxo Flanelinha). O fluxo Flanelinha
(sub-projeto 4) entregou a Carteira Digital (`flanelinha/home.tsx`) com QR code, mas duas
capacidades foram explicitamente deixadas de fora nos specs anteriores — captura de foto do
Flanelinha (fora de escopo desde o sub-projeto 3) e qualquer forma de gerar uma versão física da
carteirinha (fora de escopo do sub-projeto 4). Este sub-projeto entrega as duas: foto do Flanelinha
(capturada pelo Fiscal no cadastro, editável depois) e exportação da carteirinha pra PDF pra
impressão, incluindo a foto.

São duas capacidades tecnicamente independentes (foto e PDF), mas tratadas num único sub-projeto
porque o único consumidor da foto nesta etapa é justamente o PDF (e, por decisão do usuário, o
próprio cartão digital) — não faz sentido entregar a foto sem nenhum lugar pra ela aparecer.

## Decisões confirmadas com o usuário

1. **Quem tira a foto**: o Fiscal, no momento do cadastro (fluxo presencial, como um documento
   oficial de verdade) — não o próprio Flanelinha.
2. **Foto no cartão digital**: sim, aparece tanto no cartão digital do app (`flanelinha/home.tsx`)
   quanto no PDF exportado — não é exclusiva do PDF.
3. **Edição da foto**: incluída na tela de Detalhe/Editar Flanelinha do Fiscal, junto com os outros
   campos já editáveis.
4. **Captura**: câmera e galeria, ambas disponíveis (não só câmera).
5. **Obrigatoriedade**: foto é opcional. Sem foto, o cartão digital e o PDF mostram um placeholder
   genérico (ícone de pessoa) no lugar.
6. **Novo campo no PDF**: CPF passa a aparecer no PDF (documento físico de identificação), mesmo
   não aparecendo no cartão digital do app.
7. **Entrega do PDF**: menu de compartilhar nativo do Android (`expo-sharing`), não salvar direto
   no dispositivo — evita pedir permissão de armazenamento e deixa o usuário escolher onde mandar
   (Arquivos, WhatsApp, um app de impressão, etc.).
8. **Rebuild do dev client**: aceito. Ao contrário do QR code (sub-projeto 4, que evitou
   `react-native-svg` de propósito pra não precisar reconstruir o dev client), acesso a
   câmera/galeria não tem alternativa pura-JS em React Native — o rebuild é inevitável aqui, e as
   quatro dependências nativas novas deste sub-projeto (`expo-image-picker`,
   `expo-image-manipulator`, `expo-print`, `expo-sharing`) compartilham o mesmo rebuild único.
9. **Armazenamento da foto**: base64 direto no Postgres (sem infraestrutura nova), com uma
   ressalva: a query por trás da lista de Flanelinhas do Fiscal (`GET /api/flanelinha`) nunca
   carrega a coluna da foto — só os endpoints de registro único (`GetById`, `GetMe`) trazem os
   bytes reais. Ver seção 1.
10. **Geração do PDF**: no cliente, via `expo-print` (renderiza um PDF a partir de uma string HTML)
    — não no backend. Gerar no backend duplicaria a lógica de desenho do QR code (que já existe no
    cliente, `src/utils/qrcode.ts`) e exigiria manter dois templates visuais sincronizados.
11. **Layout do PDF**: confirmado via companion visual — cartão vertical (Layout A), tamanho padrão
    de cartão de identificação, centralizado numa página A4 pra imprimir e recortar. Ver seção 4.
12. **Verificação**: sem framework de testes automatizados (mesma convenção dos sub-projetos
    anteriores) — verificação manual contra o backend real, depois do rebuild do dev client.

## 1. Extensão do backend

`api/Models/Flanelinha.cs` — novo campo, nullable (decisão 5):

```csharp
public string? FotoBase64 {get; set;}
```

(String base64 crua, sem o prefixo `data:image/jpeg;base64,` — esse prefixo é responsabilidade do
cliente na hora de renderizar, não é armazenado.)

`api/Dtos/Flanelinha/CreateFlanelinhaDto.cs`, `UpdateFlanelinhaDto.cs` (edição pelo Fiscal) e
`FlanelinhaDto.cs` — todos ganham o mesmo campo opcional:

```csharp
public string? FotoBase64 { get; set; }
```

Sem `[Required]` em nenhum dos DTOs de entrada (decisão 5). `FlanelinhaMappers.cs` — `ToFlanelinhaDto()`
passa a mapear `FotoBase64`, `ToCreateFlanelinhaDto()` e o corpo de `UpdateByFiscal` no controller
passam a atribuir o campo, mesmo padrão dos campos já existentes.

**A ressalva da decisão 9** — hoje `GetAllByFiscalWithCarterinhasAsync`
(`api/Repositories/FlanelinhaRepository.cs`) carrega entidades `Flanelinha` completas
(`_dbSet.Include(f => f.Carterinhas).Where(...).ToListAsync()`) e só depois mapeia pra
`FlanelinhaDto` no controller. Se `FotoBase64` for só mais uma propriedade da entidade, essa query
passaria a trazer a foto de **cada** Flanelinha do Fiscal a cada carregamento da lista — um custo
que cresce com o tempo e não é hipotético, é uma consequência direta e previsível de como a tela
`fiscal/flanelinhas.tsx` já funciona hoje (recarrega a lista completa a cada vez que a tela ganha
foco).

Fix: `GetAllByFiscalWithCarterinhasAsync` passa a projetar direto pra `FlanelinhaDto` via `.Select()`
no LINQ, sem carregar a entidade completa primeiro, deixando `FotoBase64` explicitamente `null`:

```csharp
public async Task<List<FlanelinhaDto>> GetAllByFiscalWithCarterinhasAsync(int idFiscal, CancellationToken ct = default)
{
    return await _dbSet
        .Where(f => f.IdFiscal == idFiscal)
        .Select(f => new FlanelinhaDto
        {
            IdFlanel = f.IdFlanel,
            Nome = f.Nome,
            Email = f.Email,
            Cpf = f.Cpf,
            PontoAtuacao = f.PontoAtuacao,
            Telefone = f.Telefone,
            Ativo = f.Ativo,
            DataCadastro = f.DataCadastro,
            IdFiscal = f.IdFiscal,
            FotoBase64 = null,
            Carterinhas = f.Carterinhas.Select(c => new CarterinhaDto
            {
                IdCarterinha = c.IdCarterinha,
                NumeroCarterinha = c.NumeroCarterinha,
                DataEmissao = c.DataEmissao,
                DataValidade = c.DataValidade,
                Ativo = c.Ativo,
                Tipo = c.Tipo
            }).ToList()
        })
        .ToListAsync(ct);
}
```

Isso muda a assinatura do método de `Task<List<Flanelinha>>` pra `Task<List<FlanelinhaDto>>` (e a
interface `IFlanelinhaRepository` correspondente) — o controller (`GetAll` em
`FlanelinhaController.cs`) deixa de chamar `.Select(f => f.ToFlanelinhaDto())` em cima do resultado,
já que o repositório agora devolve DTOs prontos:

```csharp
[HttpGet]
[Authorize(Roles = "Fiscal")]
public async Task<IActionResult> GetAll(CancellationToken ct)
{
    var flanelinhas = await _flanelinhaRepository.GetAllByFiscalWithCarterinhasAsync(AuthenticatedId, ct);
    return Ok(flanelinhas);
}
```

`GetByIdWithCarterinhasAsync` e `GetMe` continuam carregando a entidade completa (incluindo
`FotoBase64`) normalmente — só a query da lista muda.

Sem alteração no `Program.cs`/Kestrel: o payload de uma foto comprimida no cliente (seção 2, ~480×480
JPEG qualidade ~60%) fica bem abaixo do limite padrão de tamanho de requisição do Kestrel, então não
precisa de configuração adicional.

## 2. Novas dependências (mobile)

Todas exigem o rebuild do dev client (decisão 8):

- `expo-image-picker` — câmera e galeria numa API só.
- `expo-image-manipulator` — redimensiona (~480×480 máx) e recomprime (JPEG, qualidade ~0.6) antes
  do upload, mantendo o payload pequeno tanto na subida quanto no armazenamento.
- `expo-print` — gera um PDF a partir de uma string HTML.
- `expo-sharing` — abre o menu de compartilhar nativo do Android.

`mobile/app.json` — `expo-image-picker` precisa entrar no array `plugins` com as strings de
permissão (câmera e galeria):

```json
"plugins": [
  "expo-router",
  "expo-status-bar",
  [
    "expo-image-picker",
    {
      "photosPermission": "O app precisa de acesso às fotos para definir a foto do Flanelinha.",
      "cameraPermission": "O app precisa da câmera para tirar a foto do Flanelinha."
    }
  ]
]
```

`expo-print` e `expo-sharing` não exigem entrada em `plugins` (não pedem permissões de
tempo-de-instalação além do que o Android já concede por padrão pra gerar/compartilhar arquivos via
`FileProvider`, mecanismo que o próprio Expo já configura).

## 3. Estrutura de arquivos e componentes novos (mobile)

```
mobile/
  app/
    fiscal/
      cadastrar-flanelinha.tsx        # Modificado — adiciona PhotoPicker
      flanelinha/
        [id].tsx                      # Modificado — adiciona PhotoPicker
    flanelinha/
      home.tsx                        # Modificado — adiciona Avatar + botão Exportar PDF
  src/
    api/
      flanelinha.ts                   # Modificado — FotoBase64 nos payloads de create/update
    components/
      PhotoPicker.tsx                 # Novo
      Avatar.tsx                      # Novo
    types/
      flanelinha.ts                   # Modificado — fotoBase64 nos DTOs
    utils/
      photo.ts                        # Novo
      pdf.ts                          # Novo
```

### 3.1 `src/utils/photo.ts`

```typescript
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
```

Passar só a maior dimensão da foto original (largura ou altura, o que for maior) mantém a proporção
original — suficiente pra manter o arquivo pequeno sem distorcer nem cortar a foto.

### 3.2 `src/components/PhotoPicker.tsx`

Botão único "Adicionar Foto" / "Trocar Foto" (rótulo muda conforme já existe uma foto ou não) que
abre um `ActionSheetIOS`-style menu — como o design system não tem um componente de action sheet
ainda e isso seria desproporcional pra um único uso, usa o `Alert.alert` nativo do React Native com
botões (`"Tirar Foto"`, `"Escolher da Galeria"`, `"Cancelar"`), que já funciona como um menu de
opções simples em ambas as plataformas sem dependência nova.

```typescript
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
```

`onChange`/`onError` (em vez de um estado interno) seguem o mesmo padrão de todo `Input` já existente
no design system — o formulário pai (`cadastrar-flanelinha.tsx`, `flanelinha/[id].tsx`) é quem guarda
o valor e decide como mostrar o erro (o `Banner` já usado em cada uma dessas telas).

### 3.3 `src/components/Avatar.tsx`

```typescript
import { Image, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/colors";

interface AvatarProps {
  base64: string | null;
  size: number;
}

export function Avatar({ base64, size }: AvatarProps) {
  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      {base64 ? (
        <Image
          source={{ uri: `data:image/jpeg;base64,${base64}` }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <Text style={{ fontSize: size * 0.4 }}>👤</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
```

Emoji como placeholder (`👤`) em vez de um ícone de biblioteca — o projeto não tem nenhuma
dependência de ícones hoje (os poucos "ícones" existentes, como no mockup do estado vazio de
`flanelinha/home.tsx`, já são emoji/texto), então isso não introduz nada novo.

### 3.4 Telas do Fiscal (`cadastrar-flanelinha.tsx`, `flanelinha/[id].tsx`)

Ambas ganham um novo estado `const [fotoBase64, setFotoBase64] = useState<string | null>(null)`
(em `[id].tsx`, inicializado a partir do `data.fotoBase64` retornado pelo `getFlanelinha`) e
`<PhotoPicker value={fotoBase64} onChange={setFotoBase64} onError={(msg) => setErrorMessage(msg)} />`
inserido no topo do formulário, antes do campo Nome. `fotoBase64` entra no corpo de
`createFlanelinha`/`updateFlanelinha` como mais um campo do DTO — sem validação de obrigatoriedade
(decisão 5), então `handleSubmit` em nenhuma das duas telas trata a ausência de foto como erro.

### 3.5 Home do Flanelinha (`flanelinha/home.tsx`)

Dois acréscimos ao estado dessa tela, junto ao que a Task 6 do sub-projeto 4 já buscava
(`getMyFlanelinha()` no `useFocusEffect` existente):

- `fotoBase64` e `cpf` — ambos já vêm na resposta de `/me` (`FlanelinhaDto` completo), só não eram
  lidos antes. `cpf` é necessário aqui porque o PDF (seção 4) precisa dele mesmo que o cartão digital
  continue sem mostrá-lo (decisão 6).
- `<Avatar base64={fotoBase64} size={72} />` no topo do cartão, acima do nome — mesma composição do
  Layout A aprovado no companion visual.
- Um botão "Exportar PDF" logo abaixo do cartão, ao lado (ou no lugar, quando vencida) do botão de
  Solicitar Renovação. `home.tsx` já tem um retorno antecipado inteiramente separado pro estado sem
  carteira (`if (!carteiraAtual) { ... }`, seção 3.1 do sub-projeto 4) — não existe cartão nem rodapé
  nesse branch pra um botão desabilitado morar. Por isso o botão não é "desabilitado quando sem
  carteira": ele simplesmente só existe nos dois branches que já renderizam o cartão (ativa e
  vencida) — mesmo um card vencido pode ser útil de ter impresso, por exemplo enquanto aguarda a
  renovação. O estado vazio continua exatamente como está hoje, sem nenhum botão de exportar.

## 4. Geração do PDF (`src/utils/pdf.ts`)

```typescript
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { getQrMatrix } from "@/utils/qrcode";
import { colors } from "@/theme/colors";
import { formatDate, formatNumeroCarteira } from "@/utils/carteira";
import type { CarterinhaDto } from "@/types/flanelinha";

interface CarteiraPdfData {
  nome: string;
  cpf: string;
  pontoAtuacao: string;
  fotoBase64: string | null;
  carteira: CarterinhaDto;
}

function qrMatrixToHtml(value: string, moduleSizePx: number): string {
  const matrix = getQrMatrix(value);
  const rows = matrix
    .map(
      (row) =>
        `<div style="display:flex;">${row
          .map(
            (isDark) =>
              `<div style="width:${moduleSizePx}px;height:${moduleSizePx}px;background:${
                isDark ? colors.text : "#fff"
              };"></div>`
          )
          .join("")}</div>`
    )
    .join("");
  return `<div style="display:inline-block;">${rows}</div>`;
}

function formatCpf(cpf: string): string {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function buildCardHtml(data: CarteiraPdfData): string {
  const fotoHtml = data.fotoBase64
    ? `<img src="data:image/jpeg;base64,${data.fotoBase64}" style="width:88px;height:88px;border-radius:44px;object-fit:cover;" />`
    : `<div style="width:88px;height:88px;border-radius:44px;background:#E2E8F0;"></div>`;

  return `
    <html>
      <body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:-apple-system,sans-serif;">
        <div style="width:520px;height:328px;border:2px solid ${colors.primary};border-radius:16px;padding:20px;box-sizing:border-box;">
          <div style="font-size:11px;letter-spacing:1.5px;color:${colors.textMuted};text-transform:uppercase;font-weight:700;text-align:center;border-bottom:1px solid ${colors.border};padding-bottom:10px;margin-bottom:14px;">
            Carteira de Flanelinha
          </div>
          <div style="display:flex;justify-content:center;margin-bottom:10px;">${fotoHtml}</div>
          <div style="text-align:center;font-size:19px;font-weight:700;color:${colors.text};margin-bottom:14px;">
            ${data.nome}
          </div>
          <div style="display:flex;justify-content:space-around;margin-bottom:12px;">
            <div style="text-align:center;">
              <div style="font-size:10px;color:${colors.textMuted};text-transform:uppercase;">Número</div>
              <div style="font-size:13px;font-weight:600;color:${colors.text};">${formatNumeroCarteira(data.carteira.numeroCarterinha)}</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:10px;color:${colors.textMuted};text-transform:uppercase;">Validade</div>
              <div style="font-size:13px;font-weight:600;color:${colors.text};">${formatDate(data.carteira.dataValidade)}</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:10px;color:${colors.textMuted};text-transform:uppercase;">Ponto de Atuação</div>
              <div style="font-size:13px;font-weight:600;color:${colors.text};">${data.pontoAtuacao}</div>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:12px;border-top:1px dashed ${colors.border};">
            <span style="font-size:12px;color:${colors.text};font-weight:600;">CPF ${formatCpf(data.cpf)}</span>
            ${qrMatrixToHtml(String(data.carteira.numeroCarterinha), 4)}
          </div>
        </div>
      </body>
    </html>
  `;
}

// A4 a 72 PPI (o padrão do expo-print, sem PPI configurável) — 210×297mm ≈ 595×842px. Sem isso,
// printToFileAsync usa o tamanho padrão da lib (US Letter, 612×792), não A4 (decisão 11).
const A4_WIDTH_PX = 595;
const A4_HEIGHT_PX = 842;

export async function exportCarteiraPdf(data: CarteiraPdfData): Promise<void> {
  const html = buildCardHtml(data);
  const { uri } = await Print.printToFileAsync({ html, width: A4_WIDTH_PX, height: A4_HEIGHT_PX });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
  }
}
```

`exportCarteiraPdf` lança se `Print.printToFileAsync` falhar — o chamador (`flanelinha/home.tsx`)
captura isso no mesmo padrão `try/catch` + `Banner` já usado por toda ação assíncrona no app.
`Sharing.isAvailableAsync()` é checado antes de compartilhar por segurança (documentado pela própria
lib como podendo ser `false` em alguns ambientes), mas na prática todo dispositivo Android real tem
compartilhamento disponível — se for `false`, a função simplesmente não abre o menu (o PDF já foi
gerado com sucesso, só não há como compartilhá-lo automaticamente; fora do escopo tratar esse caso
com uma UI dedicada, já que não é esperado acontecer no dispositivo de teste real).

`formatCpf` é local a este arquivo (não em `utils/carteira.ts`) porque só o PDF mostra CPF
formatado — nenhuma tela do app precisa dessa função hoje.

## 5. Verificação

Sem framework de testes automatizados (mesma convenção dos sub-projetos anteriores). Antes de
testar: reconstruir e reinstalar o dev client custom no celular (`npx expo run:android` ou
equivalente, já que quatro dependências nativas novas foram adicionadas). Depois, contra o backend
real:

- Cadastrar Flanelinha com foto (câmera) → sucesso, foto aparece na tela de detalhe depois.
- Cadastrar Flanelinha com foto (galeria) → mesmo resultado.
- Cadastrar Flanelinha sem foto → sucesso, `Avatar` mostra o placeholder no cartão digital do
  Flanelinha.
- Editar Flanelinha, trocar uma foto existente → nova foto persiste e aparece corretamente depois.
- Negar permissão de câmera/galeria → mensagem de erro clara, sem travar a tela.
- Visualizar Flanelinhas (lista) com várias fotos cadastradas → lista carrega sem lentidão perceptível
  (checagem informal da mudança de query da seção 1).
- Exportar PDF com foto e carteira ativa → PDF abre corretamente via o menu de compartilhar, todos
  os campos corretos (incluindo CPF), QR code escaneia pro número certo.
- Exportar PDF sem foto → placeholder aparece no PDF, nada quebra.
- Exportar PDF sem carteira → botão não aparece na tela (estado vazio, sem cartão).
- Exportar PDF com carteira vencida → botão habilitado, PDF gerado normalmente.

## Fora de escopo

- Salvar o PDF direto no dispositivo (decisão 7) — só compartilhar via o menu nativo.
- Geração do PDF no backend (decisão 10).
- Foto obrigatória no cadastro (decisão 5).
- Qualquer edição de foto pelo próprio Flanelinha (decisão 1 — só o Fiscal captura/edita).
- Um componente de action sheet reutilizável no design system — usado `Alert.alert` nativo
  diretamente (seção 3.2), único lugar que precisa disso até agora.
- Cache/otimização adicional de imagens (ex. miniaturas separadas da foto de exibição) — a mesma
  foto comprimida (~480×480) serve tanto pro `Avatar` pequeno quanto pro PDF.
