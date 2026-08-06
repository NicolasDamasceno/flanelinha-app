# Carteirinha PDF Export (with Photo) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the Fiscal capture a photo of a Flanelinha at registration (editable later), show that
photo on the Flanelinha's digital ID card, and let the Flanelinha export their card as a printable
PDF (including the photo, CPF, and QR code) shared via the Android share sheet.

**Architecture:** The photo is stored as a base64 string on `Flanelinha`, excluded from the Fiscal's
list query (which stays lean) but included on single-record reads. The PDF is generated entirely
client-side via `expo-print` (HTML → PDF) reusing the existing QR-matrix logic, then handed to
`expo-sharing`'s native share sheet — no backend involvement in PDF generation.

**Tech Stack:** ASP.NET Core/EF Core (existing), React Native/Expo (existing), four new native Expo
modules: `expo-image-picker`, `expo-image-manipulator`, `expo-print`, `expo-sharing`.

---

## Chunk 1: Backend and mobile foundations

### Task 1: Backend — `FotoBase64` field, DTOs, mapper, migration

**Files:**
- Modify: `api/Models/Flanelinha.cs`
- Modify: `api/Dtos/Flanelinha/CreateFlanelinhaDto.cs`
- Modify: `api/Dtos/Flanelinha/UpdateFlanelinhaDto.cs`
- Modify: `api/Dtos/Flanelinha/FlanelinhaDto.cs`
- Modify: `api/Mappers/FlanelinhaMappers.cs`
- Modify: `api/Controllers/FlanelinhaController.cs`
- Create: `api/Migrations/<timestamp>_FlanelinhaFoto.cs` (generated, not hand-written)

- [ ] **Step 1: Add the field to the model**

In `api/Models/Flanelinha.cs`, add this property (nullable, matching the existing style of this
file — no `[Required]`, initialized to `null` implicitly since it's a nullable reference type):

```csharp
public string? FotoBase64 {get; set;}
```

- [ ] **Step 2: Add the field to the three DTOs**

In `api/Dtos/Flanelinha/CreateFlanelinhaDto.cs`, add (no `[Required]` — the photo is optional):

```csharp
public string? FotoBase64 { get; set; }
```

Same addition in `api/Dtos/Flanelinha/UpdateFlanelinhaDto.cs` and
`api/Dtos/Flanelinha/FlanelinhaDto.cs`.

- [ ] **Step 3: Update the mapper**

In `api/Mappers/FlanelinhaMappers.cs`, `ToFlanelinhaDto()` gains one line:

```csharp
public static FlanelinhaDto ToFlanelinhaDto(this Flanelinha flanelinhaModel)
{
    return new FlanelinhaDto
    {
        IdFlanel = flanelinhaModel.IdFlanel,
        Nome = flanelinhaModel.Nome,
        Email = flanelinhaModel.Email,
        Cpf = flanelinhaModel.Cpf,
        PontoAtuacao = flanelinhaModel.PontoAtuacao,
        Telefone = flanelinhaModel.Telefone,
        Ativo = flanelinhaModel.Ativo,
        DataCadastro = flanelinhaModel.DataCadastro,
        IdFiscal = flanelinhaModel.IdFiscal,
        FotoBase64 = flanelinhaModel.FotoBase64,
        Carterinhas = flanelinhaModel.Carterinhas.Select(c => c.ToCarterinhaDto()).ToList()
    };
}
```

`ToCreateFlanelinhaDto()` also gains one line:

```csharp
public static Flanelinha ToCreateFlanelinhaDto(this CreateFlanelinhaDto flanelinhaDto)
{
    return new Flanelinha
    {
        Nome = flanelinhaDto.Nome,
        Email = flanelinhaDto.Email,
        Cpf = flanelinhaDto.Cpf,
        PontoAtuacao = flanelinhaDto.PontoAtuacao,
        Telefone = flanelinhaDto.Telefone,
        Ativo = flanelinhaDto.Ativo,
        Senha = flanelinhaDto.Senha,
        FotoBase64 = flanelinhaDto.FotoBase64,
        DataCadastro = DateTime.UtcNow
    };
}
```

- [ ] **Step 4: Wire the field into `UpdateByFiscal`**

In `api/Controllers/FlanelinhaController.cs`, the `UpdateByFiscal` action (the Fiscal-side edit —
`PUT /api/flanelinha/{id}`) already assigns every field from `dto` onto `flanelinha` one line at a
time. Add `FotoBase64` to that block:

```csharp
flanelinha.Nome = dto.Nome;
flanelinha.Email = dto.Email;
flanelinha.PontoAtuacao = dto.PontoAtuacao;
flanelinha.Telefone = dto.Telefone;
flanelinha.Ativo = dto.Ativo!.Value;
flanelinha.FotoBase64 = dto.FotoBase64;
```

Don't touch `Create`, `GetById`, `GetMe`, `UpdatePerfil`, `ChangePassword`, or `RequestCarteira` in
this task — none of them need changes for this field (`Create` already goes through
`ToCreateFlanelinhaDto()`, which Step 3 covered; `GetById`/`GetMe` already go through
`ToFlanelinhaDto()`, which Step 3 also covered).

- [ ] **Step 5: Generate the migration**

Run from `api/`:

```bash
dotnet ef migrations add FlanelinhaFoto
```

This generates a new file in `api/Migrations/` (timestamped, e.g.
`api/Migrations/20260806HHMMSS_FlanelinhaFoto.cs`) plus its `.Designer.cs` and an updated
`ApplicationDBContextModelSnapshot.cs` — don't hand-write these, the EF Core CLI generates them from
the model change in Step 1. Expected generated migration body (for reference, to confirm the CLI did
the right thing — actual timestamp will differ):

```csharp
protected override void Up(MigrationBuilder migrationBuilder)
{
    migrationBuilder.AddColumn<string>(
        name: "FotoBase64",
        table: "Flanelinhas",
        type: "text",
        nullable: true);
}

protected override void Down(MigrationBuilder migrationBuilder)
{
    migrationBuilder.DropColumn(
        name: "FotoBase64",
        table: "Flanelinhas");
}
```

- [ ] **Step 6: Verify it builds**

Run: `dotnet build` from `api/`
Expected: `Compilação com êxito. 0 Erro(s)`

- [ ] **Step 7: Apply the migration and verify it builds/runs**

Run: `dotnet ef database update` from `api/` (applies the new column to your local Postgres)
Run: `dotnet build` from `api/` again to confirm the generated migration files compile

- [ ] **Step 8: Commit**

```bash
git add api/Models/Flanelinha.cs api/Dtos/Flanelinha/CreateFlanelinhaDto.cs api/Dtos/Flanelinha/UpdateFlanelinhaDto.cs api/Dtos/Flanelinha/FlanelinhaDto.cs api/Mappers/FlanelinhaMappers.cs api/Controllers/FlanelinhaController.cs api/Migrations/
git commit -m "feat: add FotoBase64 field to Flanelinha"
```

---

### Task 2: Backend — exclude photo from the Fiscal's list query

**Files:**
- Modify: `api/Interfaces/IFlanelinhaRepository.cs`
- Modify: `api/Repositories/FlanelinhaRepository.cs`
- Modify: `api/Controllers/FlanelinhaController.cs`

- [ ] **Step 1: Change the repository interface**

In `api/Interfaces/IFlanelinhaRepository.cs`, change the return type of
`GetAllByFiscalWithCarterinhasAsync`:

```csharp
using api.Dtos.Flanelinha;
using api.Models;

namespace api.Interfaces
{
    public interface IFlanelinhaRepository : IRepository<Flanelinha>
    {
        Task<Flanelinha?> GetByCpfAsync(string cpf, CancellationToken ct = default);
        Task<List<FlanelinhaDto>> GetAllByFiscalWithCarterinhasAsync(int idFiscal, CancellationToken ct = default);
        Task<Flanelinha?> GetByIdWithCarterinhasAsync(int id, CancellationToken ct = default);
        Task<Carterinha?> GetCarterinhaAtivaAsync(int idFlanel, CancellationToken ct = default);
        Task AddCarterinhaAsync(Carterinha carterinha, CancellationToken ct = default);
        Task<int> GetProximoNumeroCarterinhaAsync(CancellationToken ct = default);
    }
}
```

- [ ] **Step 2: Change the repository implementation**

In `api/Repositories/FlanelinhaRepository.cs`, replace `GetAllByFiscalWithCarterinhasAsync` — instead
of loading full `Flanelinha` entities and mapping them afterward, project directly to
`FlanelinhaDto` in the LINQ query itself, leaving `FotoBase64` explicitly `null`. This means the
photo column is never fetched from Postgres for this query, regardless of how many Flanelinhas a
Fiscal has registered:

```csharp
using api.Data;
using api.Dtos.Flanelinha;
using api.Interfaces;
using api.Models;
using Microsoft.EntityFrameworkCore;

namespace api.Repositories
{
    public class FlanelinhaRepository : RepositoryBase<Flanelinha>, IFlanelinhaRepository
    {
        public FlanelinhaRepository(ApplicationDBContext context) : base(context)
        {
        }

        public async Task<Flanelinha?> GetByCpfAsync(string cpf, CancellationToken ct = default)
        {
            return await _dbSet.FirstOrDefaultAsync(f => f.Cpf == cpf, ct);
        }

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

        public async Task<Flanelinha?> GetByIdWithCarterinhasAsync(int id, CancellationToken ct = default)
        {
            return await _dbSet
                .Include(f => f.Carterinhas)
                .FirstOrDefaultAsync(f => f.IdFlanel == id, ct);
        }

        public async Task<Carterinha?> GetCarterinhaAtivaAsync(int idFlanel, CancellationToken ct = default)
        {
            return await _context.Carterinhas
                .Where(c => c.IdFlanel == idFlanel && c.Ativo)
                .OrderByDescending(c => c.DataEmissao)
                .FirstOrDefaultAsync(ct);
        }

        public async Task AddCarterinhaAsync(Carterinha carterinha, CancellationToken ct = default)
        {
            await _context.Carterinhas.AddAsync(carterinha, ct);
        }

        public async Task<int> GetProximoNumeroCarterinhaAsync(CancellationToken ct = default)
        {
            var maiorNumero = await _context.Carterinhas.MaxAsync(c => (int?)c.NumeroCarterinha, ct);
            return (maiorNumero ?? 0) + 1;
        }
    }
}
```

Note this deliberately uses `new CarterinhaDto { ... }` field-by-field inside the `.Select()`, not
the `.ToCarterinhaDto()` extension method used elsewhere in this codebase — EF Core can translate a
plain object-initializer projection into SQL, but it cannot translate a call to an external C#
extension method, so `.ToCarterinhaDto()` would fail at query-execution time here.

- [ ] **Step 3: Update the controller**

In `api/Controllers/FlanelinhaController.cs`, `GetAll` no longer needs to map the repository result
(it's already a list of DTOs):

```csharp
[HttpGet]
[Authorize(Roles = "Fiscal")]
public async Task<IActionResult> GetAll(CancellationToken ct)
{
    var flanelinhas = await _flanelinhaRepository.GetAllByFiscalWithCarterinhasAsync(AuthenticatedId, ct);
    return Ok(flanelinhas);
}
```

- [ ] **Step 4: Verify it builds**

Run: `dotnet build` from `api/`
Expected: `Compilação com êxito. 0 Erro(s)`

- [ ] **Step 5: Commit**

```bash
git add api/Interfaces/IFlanelinhaRepository.cs api/Repositories/FlanelinhaRepository.cs api/Controllers/FlanelinhaController.cs
git commit -m "perf: exclude photo from Fiscal's Flanelinha list query"
```

---

### Task 3: Mobile — install native dependencies and configure permissions

**Files:**
- Modify: `mobile/package.json` (new dependencies)
- Modify: `mobile/app.json`

- [ ] **Step 1: Install the four new dependencies**

Run from `mobile/`:

```bash
npx expo install expo-image-picker expo-image-manipulator expo-print expo-sharing
```

Using `expo install` (not plain `npm install`) so Expo resolves versions compatible with this
project's SDK (`~57.0.9`). All four are native modules — none of them work without rebuilding the
custom dev client (Task 12).

- [ ] **Step 2: Add `expo-image-picker`'s permission config to `app.json`**

Only `expo-image-picker` needs a `plugins` entry (camera/photo permission strings for the native
manifest) — `expo-image-manipulator`, `expo-print`, and `expo-sharing` need no special permissions
beyond what Expo's `FileProvider` setup already covers. Open `mobile/app.json` and change the
`plugins` array from:

```json
"plugins": [
  "expo-router",
  "expo-status-bar"
],
```

to:

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
],
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit` from `mobile/`
Expected: no errors (nothing consumes these packages yet — this only confirms the install itself
didn't break anything).

- [ ] **Step 4: Commit**

```bash
git add mobile/package.json mobile/package-lock.json mobile/app.json
git commit -m "feat: add native dependencies for photo capture and PDF export"
```

---

### Task 4: Mobile — `fotoBase64` in shared types

**Files:**
- Modify: `mobile/src/types/flanelinha.ts`

- [ ] **Step 1: Add the field to the three DTOs**

```typescript
export interface CarterinhaDto {
  idCarterinha: number;
  numeroCarterinha: number;
  dataEmissao: string;
  dataValidade: string;
  ativo: boolean;
  tipo: number; // TipoCarterinha do backend, serializado como int — 1 = PrimeiraVia, 2 =
                // SegundaVia. Não usado por nenhuma tela hoje.
}

export interface FlanelinhaDto {
  idFlanel: number;
  nome: string;
  email: string;
  cpf: string;
  pontoAtuacao: string;
  telefone: string;
  ativo: boolean;
  dataCadastro: string;
  idFiscal: number | null;
  fotoBase64: string | null;
  carterinhas: CarterinhaDto[];
}

export interface CreateFlanelinhaDto {
  nome: string;
  email: string;
  cpf: string;
  pontoAtuacao: string;
  telefone: string;
  fotoBase64: string | null;
}

export interface UpdateFlanelinhaDto {
  nome: string;
  email: string;
  pontoAtuacao: string;
  telefone: string;
  ativo: boolean;
  fotoBase64: string | null;
}
```

`mobile/src/api/flanelinha.ts` needs no changes in this task — `createFlanelinha`/`updateFlanelinha`
already accept `CreateFlanelinhaDto`/`UpdateFlanelinhaDto` as a parameter and forward it as the
request body, so the new field flows through automatically once the type includes it. The screens
that call these functions (Tasks 8-9) are what actually populate `fotoBase64`.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit` from `mobile/`
Expected: **errors** — `cadastrar-flanelinha.tsx` and `flanelinha/[id].tsx` currently call
`createFlanelinha`/`updateFlanelinha` with object literals missing the now-required `fotoBase64`
field. This is expected and will be fixed in Tasks 8-9; don't fix it in this task.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/types/flanelinha.ts
git commit -m "feat: add fotoBase64 to Flanelinha DTOs"
```

---

### Task 5: Mobile — `src/utils/photo.ts`

**Files:**
- Create: `mobile/src/utils/photo.ts`

- [ ] **Step 1: Write the util**

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

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit` from `mobile/`
Expected: same pre-existing errors from Task 4 (still not fixed), no *new* errors from this file.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/utils/photo.ts
git commit -m "feat: add photo capture and compression util"
```

---

### Task 6: Mobile — `src/components/Avatar.tsx`

**Files:**
- Create: `mobile/src/components/Avatar.tsx`

- [ ] **Step 1: Write the component**

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

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit` from `mobile/`
Expected: same pre-existing errors from Task 4, no new ones.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/components/Avatar.tsx
git commit -m "feat: add Avatar component with placeholder fallback"
```

---

### Task 7: Mobile — `src/components/PhotoPicker.tsx`

**Files:**
- Create: `mobile/src/components/PhotoPicker.tsx`

- [ ] **Step 1: Write the component**

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

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit` from `mobile/`
Expected: same pre-existing errors from Task 4 (from the two screens not yet updated), no new ones
from this file.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/components/PhotoPicker.tsx
git commit -m "feat: add PhotoPicker component"
```

---

## Chunk 2: Screens, PDF export, rebuild, and verification

### Task 8: Mobile — `PhotoPicker` in Cadastrar Flanelinha

**Files:**
- Modify: `mobile/app/fiscal/cadastrar-flanelinha.tsx`

- [ ] **Step 1: Add the photo state and component**

Add the import and state, then insert `<PhotoPicker>` as the first field in the form (before Nome),
and include `fotoBase64` in the `createFlanelinha` call and in the post-success reset:

```typescript
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
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

      <PhotoPicker value={fotoBase64} onChange={setFotoBase64} onError={setErrorMessage} />

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
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit` from `mobile/`
Expected: no errors from this file (the `flanelinha/[id].tsx` error from Task 4 may still remain
until Task 9 — that's fine).

- [ ] **Step 3: Commit**

```bash
git add mobile/app/fiscal/cadastrar-flanelinha.tsx
git commit -m "feat: add photo capture to Cadastrar Flanelinha"
```

---

### Task 9: Mobile — `PhotoPicker` in Detalhe/Editar Flanelinha

**Files:**
- Modify: `mobile/app/fiscal/flanelinha/[id].tsx`

- [ ] **Step 1: Add the photo state and component**

Add the import, state (initialized from the fetched record), the component in the form, and
`fotoBase64` in the `updateFlanelinha` call:

```typescript
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { deleteFlanelinha, getFlanelinha, updateFlanelinha } from "@/api/flanelinha";
import { extractErrorMessage } from "@/api/client";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { PhotoPicker } from "@/components/PhotoPicker";
import { colors } from "@/theme/colors";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function FlanelinhaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const flanelId = Number(id);
  const navigation = useNavigation();
  const activeIdRef = useRef<number | null>(flanelId);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  const [cpf, setCpf] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [pontoAtuacao, setPontoAtuacao] = useState("");
  const [telefone, setTelefone] = useState("");
  const [ativo, setAtivo] = useState(true);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!Number.isInteger(flanelId) || flanelId <= 0) {
        setLoadError("Flanelinha inválido.");
        setIsLoading(false);
        return;
      }

      activeIdRef.current = flanelId;

      let cancelled = false;
      setIsLoading(true);
      setLoadError(null);
      setErrorMessage(null);
      navigation.setOptions({ title: "Flanelinha" });

      getFlanelinha(flanelId)
        .then((data) => {
          if (cancelled) return;
          navigation.setOptions({ title: data.nome });
          setFotoBase64(data.fotoBase64);
          setCpf(data.cpf);
          setNome(data.nome);
          setEmail(data.email);
          setPontoAtuacao(data.pontoAtuacao);
          setTelefone(data.telefone.replace(/\D/g, ""));
          setAtivo(data.ativo);
        })
        .catch((error) => {
          if (!cancelled) setLoadError(extractErrorMessage(error));
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });

      return () => {
        cancelled = true;
        activeIdRef.current = null;
      };
    }, [flanelId, navigation])
  );

  async function handleSave() {
    const nomeValue = nome.trim();
    const emailValue = email.trim();
    const pontoAtuacaoValue = pontoAtuacao.trim();
    const telefoneValue = telefone.trim().replace(/\D/g, "");

    if (!nomeValue || !emailValue || !pontoAtuacaoValue || !telefoneValue) {
      setErrorMessage("Preencha todos os campos");
      return;
    }

    if (!EMAIL_PATTERN.test(emailValue)) {
      setErrorMessage("Email inválido");
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    const targetId = flanelId;

    try {
      await updateFlanelinha(targetId, {
        nome: nomeValue,
        email: emailValue,
        pontoAtuacao: pontoAtuacaoValue,
        telefone: telefoneValue,
        ativo,
        fotoBase64,
      });
      if (activeIdRef.current !== targetId) return;
      router.replace({ pathname: "/fiscal/flanelinhas", params: { edicaoSucesso: "1" } });
    } catch (error) {
      if (activeIdRef.current !== targetId) return;
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmDelete() {
    setDeleteError(null);
    setIsDeleting(true);

    try {
      await deleteFlanelinha(flanelId);
      setIsModalVisible(false);
      router.replace({ pathname: "/fiscal/flanelinhas", params: { exclusaoSucesso: "1" } });
    } catch (error) {
      setDeleteError(extractErrorMessage(error));
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.container}>
        <Banner type="error" message={loadError} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      {errorMessage ? <Banner type="error" message={errorMessage} /> : null}

      <PhotoPicker value={fotoBase64} onChange={setFotoBase64} onError={setErrorMessage} />

      <Text style={styles.readonlyLabel}>CPF</Text>
      <Text style={styles.readonlyValue}>{cpf}</Text>

      <Input label="Nome" value={nome} onChangeText={setNome} />
      <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Input label="Ponto de Atuação" value={pontoAtuacao} onChangeText={setPontoAtuacao} />
      <Input
        label="Telefone"
        value={telefone}
        onChangeText={(text) => setTelefone(text.replace(/\D/g, "").slice(0, 11))}
        keyboardType="phone-pad"
      />

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Ativo</Text>
        <Switch value={ativo} onValueChange={setAtivo} trackColor={{ true: colors.success }} />
      </View>

      <Button label="Salvar Alterações" onPress={handleSave} loading={isSaving} disabled={isDeleting} />
      <View style={styles.deleteButtonSpacing}>
        <Button label="Excluir Flanelinha" variant="secondary" onPress={() => setIsModalVisible(true)} disabled={isSaving} />
      </View>

      <Modal
        visible={isModalVisible}
        title="Excluir Flanelinha"
        onClose={() => {
          if (isDeleting) return;
          setIsModalVisible(false);
          setDeleteError(null);
        }}
        actions={
          <>
            <Button
              label="Cancelar"
              variant="secondary"
              disabled={isDeleting}
              onPress={() => {
                setIsModalVisible(false);
                setDeleteError(null);
              }}
            />
            <Button label="Excluir" onPress={handleConfirmDelete} loading={isDeleting} />
          </>
        }
      >
        {deleteError ? <Banner type="error" message={deleteError} /> : null}
        <Text>Tem certeza que deseja excluir {nome}? Essa ação não pode ser desfeita.</Text>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  readonlyLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 6,
  },
  readonlyValue: {
    fontSize: 16,
    color: colors.textMuted,
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  deleteButtonSpacing: {
    marginTop: 12,
  },
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit` from `mobile/`
Expected: no errors anywhere now — this was the last file with a Task-4-introduced gap.

- [ ] **Step 3: Commit**

```bash
git add mobile/app/fiscal/flanelinha/[id].tsx
git commit -m "feat: add photo editing to Detalhe/Editar Flanelinha"
```

---

### Task 10: Mobile — `src/utils/pdf.ts`

**Files:**
- Create: `mobile/src/utils/pdf.ts`

- [ ] **Step 1: Write the PDF generation util**

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
// printToFileAsync usa o tamanho padrão da lib (US Letter, 612×792), não A4.
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

`formatCpf` is local to this file (not `utils/carteira.ts`) because only the PDF shows a formatted
CPF — no screen needs that function today.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit` from `mobile/`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/utils/pdf.ts
git commit -m "feat: add PDF export util using expo-print and expo-sharing"
```

---

### Task 11: Mobile — Avatar, CPF, and Exportar PDF on Home

**Files:**
- Modify: `mobile/app/flanelinha/home.tsx`

- [ ] **Step 1: Add `fotoBase64`/`cpf` state, `Avatar`, and the export button**

`cpf` is fetched here (even though the digital card never displays it) because the PDF needs it.
"Exportar PDF" renders right after the existing `{vencida ? <Button label="Solicitar Renovação" ... /> : null}`
block, unconditionally — the whole card-bearing `return` only exists when `carteiraAtual` is
truthy (the separate `!carteiraAtual` early return above has no card and no room for this button,
so it correctly doesn't appear in the empty state). With an active carteira, "Exportar PDF" is the
only button under the card; with an expired one, both buttons appear together.

```typescript
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { getMyFlanelinha } from "@/api/flanelinha";
import { extractErrorMessage } from "@/api/client";
import { Avatar } from "@/components/Avatar";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { QrCode } from "@/components/QrCode";
import { colors } from "@/theme/colors";
import type { CarterinhaDto } from "@/types/flanelinha";
import { formatDate, formatNumeroCarteira, getCarteiraAtual, isCarteiraVencida } from "@/utils/carteira";
import { exportCarteiraPdf } from "@/utils/pdf";

type SuccessParams = { carteiraEmitida?: string };

export default function FlanelinhaHomeScreen() {
  const navigation = useNavigation<{ setParams: (params: SuccessParams) => void }>();
  const params = useLocalSearchParams<SuccessParams>();

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [pontoAtuacao, setPontoAtuacao] = useState("");
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  const [carteiraAtual, setCarteiraAtual] = useState<CarterinhaDto | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    if (params.carteiraEmitida === "1") {
      setSuccessMessage("Carteirinha emitida com sucesso.");
      navigation.setParams({ carteiraEmitida: undefined });
    }
  }, [params.carteiraEmitida]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setIsLoading(true);
      setErrorMessage(null);

      getMyFlanelinha()
        .then((data) => {
          if (cancelled) return;
          setNome(data.nome);
          setCpf(data.cpf);
          setPontoAtuacao(data.pontoAtuacao);
          setFotoBase64(data.fotoBase64);
          setCarteiraAtual(getCarteiraAtual(data.carterinhas));
        })
        .catch((error) => {
          if (!cancelled) setErrorMessage(extractErrorMessage(error));
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });

      return () => {
        cancelled = true;
        setSuccessMessage(null);
      };
    }, [])
  );

  async function handleExportPdf() {
    if (!carteiraAtual) return;

    setExportError(null);
    setIsExporting(true);

    try {
      await exportCarteiraPdf({ nome, cpf, pontoAtuacao, fotoBase64, carteira: carteiraAtual });
    } catch (error) {
      setExportError(extractErrorMessage(error));
    } finally {
      setIsExporting(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={styles.container}>
        <Banner type="error" message={errorMessage} />
      </View>
    );
  }

  if (!carteiraAtual) {
    return (
      <View style={styles.container}>
        {successMessage ? <Banner type="success" message={successMessage} /> : null}
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Você ainda não tem uma carteirinha</Text>
          <Text style={styles.emptyText}>
            Solicite sua primeira via para começar a usar a carteira digital.
          </Text>
        </View>
        <Button
          label="Solicitar Carteirinha"
          onPress={() => router.push("/flanelinha/solicitar-carteirinha")}
        />
      </View>
    );
  }

  const vencida = isCarteiraVencida(carteiraAtual);

  return (
    <View style={styles.container}>
      {successMessage ? <Banner type="success" message={successMessage} /> : null}
      {exportError ? <Banner type="error" message={exportError} /> : null}
      <View style={[styles.card, vencida && styles.cardVencida]}>
        <Text style={styles.cardTitle}>Carteirinha de Flanelinha</Text>
        <View style={styles.cardAvatarRow}>
          <Avatar base64={fotoBase64} size={72} />
        </View>
        <Text style={styles.cardName}>{nome}</Text>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Número</Text>
          <Text style={styles.cardValue}>{formatNumeroCarteira(carteiraAtual.numeroCarterinha)}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Ponto de Atuação</Text>
          <Text style={styles.cardValue}>{pontoAtuacao}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Validade</Text>
          <Text style={styles.cardValue}>{formatDate(carteiraAtual.dataValidade)}</Text>
        </View>
        <View style={styles.cardFooter}>
          <View
            style={[
              styles.badge,
              { backgroundColor: vencida ? colors.errorBackground : colors.successBackground },
            ]}
          >
            <Text
              style={{
                color: vencida ? colors.error : colors.success,
                fontSize: 11,
                fontWeight: "700",
              }}
            >
              {vencida ? "Vencida" : "Ativa"}
            </Text>
          </View>
          <View style={vencida ? styles.qrDimmed : undefined}>
            <QrCode value={String(carteiraAtual.numeroCarterinha)} size={96} />
          </View>
        </View>
      </View>
      {vencida ? (
        <Button
          label="Solicitar Renovação"
          onPress={() => router.push("/flanelinha/solicitar-carteirinha")}
        />
      ) : null}
      <View style={styles.exportButtonSpacing}>
        <Button label="Exportar PDF" variant="secondary" onPress={handleExportPdf} loading={isExporting} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontWeight: "700",
    color: colors.text,
    marginBottom: 6,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: 20,
  },
  card: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 14,
    padding: 18,
    backgroundColor: colors.background,
    marginBottom: 16,
  },
  cardVencida: {
    borderColor: colors.error,
  },
  cardTitle: {
    fontSize: 11,
    letterSpacing: 1,
    color: colors.textMuted,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  cardAvatarRow: {
    alignItems: "center",
    marginTop: 8,
  },
  cardName: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginTop: 8,
    textAlign: "center",
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  cardLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  cardValue: {
    fontSize: 12,
    color: colors.text,
    fontWeight: "600",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderStyle: "dashed",
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  qrDimmed: {
    opacity: 0.3,
  },
  exportButtonSpacing: {
    marginTop: 12,
  },
});
```

Note `cardName` moved from `textAlign` implicit-left to `textAlign: "center"` and `cardAvatarRow`
was added — this centers the name under the now-centered `Avatar`, matching the approved Layout A
mockup (photo centered, name centered below it).

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit` from `mobile/`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/app/flanelinha/home.tsx
git commit -m "feat: show photo on digital card and add Exportar PDF button"
```

---

### Task 12: Rebuild and reinstall the custom dev client

> **This task needs a human at a physical device — do not assume a subagent can complete it
> unattended.** Four native modules were added across Tasks 3-11 (`expo-image-picker`,
> `expo-image-manipulator`, `expo-print`, `expo-sharing`); none of them work in the previously-built
> dev client, which predates this branch. This is a single rebuild covering all four — no need to
> rebuild once per dependency.

**Files:** none (build/deploy only)

- [ ] **Step 1: Rebuild and install**

Run from `mobile/` with the physical device connected via USB (`adb devices` should show it):

```bash
npx expo run:android
```

This compiles a new native Android build (which now includes the four new native modules) and
installs it directly on the connected device, replacing the previous dev client. Expect this to take
several minutes — it's a full native build, not just a JS bundle.

- [ ] **Step 2: Confirm the new dev client launches and connects**

Open the app on the device, confirm it connects to Metro and loads the current branch's JS bundle
without the "Cannot read property ..." class of error a mismatched dev client would throw.

---

### Task 13: Manual verification against the real backend

> **This task needs a human at a physical device — do not assume a subagent can complete it
> unattended.** Requires the rebuilt dev client from Task 12, the .NET backend running locally with
> the Task 1 migration applied, and a Fiscal test account to register/edit a Flanelinha with a photo.

**Files:** none (verification only)

- [ ] **Step 1: Start the backend**

Run: `dotnet run` from `api/` (confirm the `FotoBase64` column exists — `dotnet ef database update`
from Task 1 should have already applied it, but if the backend was already running against this
worktree's Postgres before Task 1, restart it now to pick up the schema change).

- [ ] **Step 2: Walk through the checklist from the design doc**

From `docs/superpowers/specs/2026-08-06-carteirinha-pdf-export-design.md`, section 5:

- Cadastrar Flanelinha with a photo (camera) → success, photo visible on the Fiscal's detail screen
  afterward.
- Cadastrar Flanelinha with a photo (gallery) → same result.
- Cadastrar Flanelinha with no photo → success, `Avatar` shows the placeholder on the Flanelinha's
  Home card.
- Editar Flanelinha, replace an existing photo → new photo persists and displays correctly
  afterward.
- Deny camera/gallery permission → clear error message, screen doesn't get stuck.
- Visualizar Flanelinhas (list) with several photo-bearing records → list still loads without
  noticeable slowdown (informal sanity check on the Task 2 query change).
- Exportar PDF with a photo and an active carteira → PDF opens correctly via the share sheet, every
  field correct (including CPF), QR code scans to the right número.
- Exportar PDF with no photo → placeholder shows in the PDF, nothing crashes.
- Exportar PDF with no carteira yet → button doesn't appear on screen (empty state).
- Exportar PDF with an expired carteira → button appears alongside "Solicitar Renovação", PDF
  generates normally.

- [ ] **Step 3: Report and fix any issues found**

If any step fails, note the exact reproduction, fix the responsible file directly (not via a new
task), re-run `npx tsc --noEmit` / `dotnet build`, re-test that specific step, and commit the fix
separately from the task commits above.
