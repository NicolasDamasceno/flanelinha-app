# Fiscal Flow Screens Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the four Fiscal placeholder screens with real functionality (Home dashboard,
Cadastrar Flanelinha, Visualizar Flanelinhas list + detail/edit, Atualizar Dados), backed by one
new backend endpoint that lets a Fiscal edit an existing Flanelinha's data.

**Architecture:** One new ASP.NET Core action (`PUT /api/flanelinha/{id}`) plus a new DTO on the
existing `FlanelinhaController`. On the mobile side: two new thin API-wrapper modules
(`src/api/flanelinha.ts`, `src/api/fiscal.ts`), one new types file (`src/types/flanelinha.ts`), one
new method on the existing `AuthContext` (`updateProfile`), and five screen files (four replacing
placeholders, one brand new dynamic route for the Flanelinha detail/edit screen). All screens reuse
the design system components (`Button`, `Input`, `Banner`, `Modal`) and color tokens already built
in the mobile scaffold sub-project — no new reusable components are introduced.

**Tech Stack:** ASP.NET Core 9 / EF Core (backend), React Native / Expo Router / TypeScript
(mobile). No automated test framework on either side (established convention from the two prior
sub-projects) — every task's verification step is `dotnet build` / `npx tsc --noEmit` plus a manual
smoke test.

**Spec:** `docs/superpowers/specs/2026-08-03-fiscal-flow-screens-design.md` — read this first for
the full rationale behind every decision below. This plan only restates what's needed to implement
it task by task.

**Working directory:** This plan is written for the worktree at `C:\fiscal-flow` (branch
`feature/fiscal-flow-screens`, branched from `main`). **Use this exact path, not a path nested
under the repo's `.worktrees\` folder** — the mobile scaffold sub-project discovered that Windows'
`CMAKE_OBJECT_PATH_MAX` limit breaks native Android builds (`ninja: manifest 'build.ninja' still
dirty`) once the project sits too deep under `C:\Users\User\Documents\...\.worktrees\...`. This
plan doesn't add any native dependencies, so a native rebuild shouldn't be needed at all (Task 9
reuses the dev client already installed on the test phone) — but keeping the short path avoids
re-discovering the problem if that assumption turns out wrong.

Before starting Task 1, install mobile dependencies (this worktree is a fresh checkout — `mobile/`
has no `node_modules/` yet, it's gitignored):

```bash
cd C:\fiscal-flow\mobile
npm install
```

---

### Task 1: Backend — `PUT /api/flanelinha/{id}` for the owning Fiscal

**Files:**
- Create: `api/Dtos/Flanelinha/UpdateFlanelinhaDto.cs`
- Modify: `api/Controllers/FlanelinhaController.cs`

- [ ] **Step 1: Create the DTO**

```csharp
using System.ComponentModel.DataAnnotations;

namespace api.Dtos.Flanelinha
{
    public class UpdateFlanelinhaDto
    {
        [Required]
        public string Nome { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string PontoAtuacao { get; set; } = string.Empty;

        [Required]
        public string Telefone { get; set; } = string.Empty;

        public bool Ativo { get; set; }
    }
}
```

- [ ] **Step 2: Add the action to `FlanelinhaController`**

Add this action to `api/Controllers/FlanelinhaController.cs`, right after the existing
`Delete` action (around line 87, before the `[HttpPut("{id}/perfil")]` action). Same
ownership-check pattern as `GetById`/`Delete` in that same file, and the same `GetByIdAsync` (not
`GetByIdWithCarterinhasAsync`) used by `Delete` — the response's `carterinhas` field will be empty
regardless of the Flanelinha's real carteirinhas, which is fine since no screen in this plan reads
`carterinhas` from this endpoint's response.

```csharp
[HttpPut("{id}")]
[Authorize(Roles = "Fiscal")]
public async Task<IActionResult> UpdateByFiscal(int id, [FromBody] UpdateFlanelinhaDto dto, CancellationToken ct)
{
    var flanelinha = await _flanelinhaRepository.GetByIdAsync(id, ct);

    if (flanelinha == null)
    {
        return NotFound();
    }

    if (flanelinha.IdFiscal != AuthenticatedId)
    {
        return Forbid();
    }

    flanelinha.Nome = dto.Nome;
    flanelinha.Email = dto.Email;
    flanelinha.PontoAtuacao = dto.PontoAtuacao;
    flanelinha.Telefone = dto.Telefone;
    flanelinha.Ativo = dto.Ativo;

    await _flanelinhaRepository.SaveChangesAsync(ct);

    return Ok(flanelinha.ToFlanelinhaDto());
}
```

Add `using api.Dtos.Flanelinha;` at the top of the file if it isn't already there (it is — the
file already imports that namespace for `CreateFlanelinhaDto`).

- [ ] **Step 3: Verify — build**

Run from `api/`:
```
dotnet build
```
Expected: `Build succeeded.` with 0 errors.

- [ ] **Step 4: Verify — manual smoke test**

Start the API (`dotnet run` from `api/`, default profile listens on `http://localhost:5093`) and
Postgres (Docker container), then run these from a new terminal. Uses the Fiscal test account from
prior manual verification (CPF `11111111111` / `SenhaFiscal123`, `idFiscal=4`) and Flanelinha
`idFlanel=6` (CPF `44444444444`) which belongs to it — adjust the IDs below if your local DB has
different data (check via `GET /api/flanelinha` with a Fiscal token to see what's actually there).

```bash
# 1. Login as the Fiscal and capture the token
curl -s -X POST http://localhost:5093/api/auth/login -H "Content-Type: application/json" -d "{\"cpf\":\"11111111111\",\"senha\":\"SenhaFiscal123\"}"
```
Expected: `200` with a JSON body containing `"token": "..."`. Copy that token for the next calls
(referred to as `<TOKEN_A>` below).

```bash
# 2. Update a Flanelinha owned by this Fiscal
curl -s -X PUT http://localhost:5093/api/flanelinha/6 -H "Content-Type: application/json" -H "Authorization: Bearer <TOKEN_A>" -d "{\"nome\":\"Flanelinha Editado\",\"email\":\"editado@teste.com\",\"pontoAtuacao\":\"Novo Ponto\",\"telefone\":\"86988887777\",\"ativo\":false}"
```
Expected: `200` with the updated `FlanelinhaDto` in the body (`"nome":"Flanelinha Editado"`,
`"ativo":false`).

```bash
# 3. Confirm it persisted
curl -s http://localhost:5093/api/flanelinha/6 -H "Authorization: Bearer <TOKEN_A>"
```
Expected: `200`, same updated values.

```bash
# 4. Create a second Fiscal to test the ownership check (POST /api/fiscal also requires a Fiscal
#    token — use TOKEN_A here, it's just bootstrapping a second account)
curl -s -X POST http://localhost:5093/api/fiscal -H "Content-Type: application/json" -H "Authorization: Bearer <TOKEN_A>" -d "{\"nome\":\"Fiscal B\",\"cpf\":\"22222222222\",\"email\":\"fiscalb@teste.com\",\"senha\":\"SenhaFiscalB123\"}"
```
Expected: `201`. If a Fiscal with CPF `22222222222` already exists from a previous run, this
returns `400` (duplicate CPF) — that's fine, just log in with the existing account in the next
step.

```bash
# 5. Login as Fiscal B
curl -s -X POST http://localhost:5093/api/auth/login -H "Content-Type: application/json" -d "{\"cpf\":\"22222222222\",\"senha\":\"SenhaFiscalB123\"}"
```
Expected: `200` with a token (`<TOKEN_B>`).

```bash
# 6. Fiscal B tries to edit Fiscal A's Flanelinha — must be rejected
curl -s -o /dev/null -w "%{http_code}\n" -X PUT http://localhost:5093/api/flanelinha/6 -H "Content-Type: application/json" -H "Authorization: Bearer <TOKEN_B>" -d "{\"nome\":\"Hack\",\"email\":\"hack@teste.com\",\"pontoAtuacao\":\"x\",\"telefone\":\"1\",\"ativo\":true}"
```
Expected: `403`.

- [ ] **Step 5: Commit**

```bash
git add api/Dtos/Flanelinha/UpdateFlanelinhaDto.cs api/Controllers/FlanelinhaController.cs
git commit -m "feat: add PUT /api/flanelinha/{id} for Fiscal-side edits"
```

---

### Task 2: Mobile — Flanelinha types and API functions

**Files:**
- Create: `mobile/src/types/flanelinha.ts`
- Create: `mobile/src/api/flanelinha.ts`
- Create: `mobile/src/api/fiscal.ts`

- [ ] **Step 1: Types**

```typescript
// mobile/src/types/flanelinha.ts
export interface CarterinhaDto {
  idCarterinha: number;
  numeroCarterinha: number;
  dataEmissao: string;
  dataValidade: string;
  ativo: boolean;
  tipo: number; // TipoCarterinha do backend, serializado como int — 1 = PrimeiraVia, 2 =
                // SegundaVia. Não usado nesta etapa (nenhuma tela lê carterinhas ainda).
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
  carterinhas: CarterinhaDto[];
}

export interface CreateFlanelinhaDto {
  nome: string;
  email: string;
  cpf: string;
  pontoAtuacao: string;
  telefone: string;
}

export interface UpdateFlanelinhaDto {
  nome: string;
  email: string;
  pontoAtuacao: string;
  telefone: string;
  ativo: boolean;
}
```

- [ ] **Step 2: Flanelinha API functions**

```typescript
// mobile/src/api/flanelinha.ts
import { apiClient } from "@/api/client";
import type { CreateFlanelinhaDto, FlanelinhaDto, UpdateFlanelinhaDto } from "@/types/flanelinha";

export async function listFlanelinhas(): Promise<FlanelinhaDto[]> {
  const response = await apiClient.get<FlanelinhaDto[]>("/api/flanelinha");
  return response.data;
}

export async function getFlanelinha(id: number): Promise<FlanelinhaDto> {
  const response = await apiClient.get<FlanelinhaDto>(`/api/flanelinha/${id}`);
  return response.data;
}

export async function createFlanelinha(dto: CreateFlanelinhaDto): Promise<FlanelinhaDto> {
  const response = await apiClient.post<FlanelinhaDto>("/api/flanelinha", dto);
  return response.data;
}

export async function updateFlanelinha(id: number, dto: UpdateFlanelinhaDto): Promise<FlanelinhaDto> {
  const response = await apiClient.put<FlanelinhaDto>(`/api/flanelinha/${id}`, dto);
  return response.data;
}

export async function deleteFlanelinha(id: number): Promise<void> {
  await apiClient.delete(`/api/flanelinha/${id}`);
}
```

- [ ] **Step 3: Fiscal API functions**

```typescript
// mobile/src/api/fiscal.ts
import { apiClient } from "@/api/client";
import type { FiscalPerfil } from "@/types/auth";

export async function updateFiscalPerfil(
  id: number,
  dto: { nome: string; email: string }
): Promise<FiscalPerfil> {
  const response = await apiClient.put<FiscalPerfil>(`/api/fiscal/${id}/perfil`, dto);
  return response.data;
}

export async function changeFiscalPassword(
  id: number,
  senhaAtual: string,
  novaSenha: string
): Promise<void> {
  await apiClient.put(`/api/fiscal/${id}/senha`, { senhaAtual, novaSenha });
}
```

- [ ] **Step 4: Verify**

Run from `mobile/`:
```
npx tsc --noEmit
```
Expected: no output (success) — these are standalone modules with no existing callers yet, so
nothing else should be affected.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/types/flanelinha.ts mobile/src/api/flanelinha.ts mobile/src/api/fiscal.ts
git commit -m "feat: add Flanelinha types and Fiscal-side API functions"
```

---

### Task 3: Mobile — `AuthContext.updateProfile`

**Files:**
- Modify: `mobile/src/context/AuthContext.tsx`

- [ ] **Step 1: Add `updateProfile` to the context**

In `mobile/src/context/AuthContext.tsx`, add `updateProfile` to the `AuthContextValue` interface:

```typescript
interface AuthContextValue {
  session: Session | null;
  isLoading: boolean;
  login: (cpf: string, senha: string) => Promise<LoginResponse>;
  logout: (params?: Record<string, string>) => Promise<void>;
  updateProfile: (perfil: FiscalPerfil | FlanelinhaPerfil) => Promise<void>;
}
```

Add the implementation inside `AuthProvider`, after the existing `login` callback (around line 75,
before the `value = useMemo(...)` line):

```typescript
const updateProfile = useCallback(
  async (perfil: FiscalPerfil | FlanelinhaPerfil) => {
    if (!session) {
      return;
    }
    const nextSession: Session = { ...session, perfil };
    setSession(nextSession);
    await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
  },
  [session]
);
```

Update the `useMemo` to include it:

```typescript
const value = useMemo(
  () => ({ session, isLoading, login, logout, updateProfile }),
  [session, isLoading, login, logout, updateProfile]
);
```

- [ ] **Step 2: Verify**

Run from `mobile/`:
```
npx tsc --noEmit
```
Expected: no output (success).

- [ ] **Step 3: Commit**

```bash
git add mobile/src/context/AuthContext.tsx
git commit -m "feat: add AuthContext.updateProfile for in-place profile updates"
```

---

### Task 4: Fiscal Home screen

**Files:**
- Modify: `mobile/app/fiscal/home.tsx`

- [ ] **Step 1: Replace the placeholder**

```typescript
// mobile/app/fiscal/home.tsx
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { listFlanelinhas } from "@/api/flanelinha";
import { extractErrorMessage } from "@/api/client";
import { Banner } from "@/components/Banner";
import { useAuth } from "@/context/AuthContext";
import { colors } from "@/theme/colors";
import type { FiscalPerfil } from "@/types/auth";

export default function FiscalHomeScreen() {
  const { session } = useAuth();
  const perfil = session?.perfil as FiscalPerfil;

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [ativos, setAtivos] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setIsLoading(true);
      setErrorMessage(null);

      listFlanelinhas()
        .then((flanelinhas) => {
          if (cancelled) return;
          setTotal(flanelinhas.length);
          setAtivos(flanelinhas.filter((f) => f.ativo).length);
        })
        .catch((error) => {
          if (cancelled) return;
          setErrorMessage(extractErrorMessage(error));
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }, [])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Olá, {perfil.nome}</Text>
      <Text style={styles.subtitle}>Bem-vindo de volta</Text>

      {errorMessage ? <Banner type="error" message={errorMessage} /> : null}

      {isLoading ? (
        <ActivityIndicator style={styles.loading} color={colors.primary} />
      ) : errorMessage ? null : (
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{total}</Text>
            <Text style={styles.statLabel}>Flanelinhas cadastrados</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{ativos}</Text>
            <Text style={styles.statLabel}>Ativos</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: 16,
  },
  loading: {
    marginTop: 24,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  statBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.primary,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: "center",
  },
});
```

- [ ] **Step 2: Verify**

Run from `mobile/`:
```
npx tsc --noEmit
```
Expected: no output (success).

- [ ] **Step 3: Commit**

```bash
git add mobile/app/fiscal/home.tsx
git commit -m "feat: implement Fiscal Home screen with summary stats"
```

---

### Task 5: Cadastrar Flanelinha screen

**Files:**
- Modify: `mobile/app/fiscal/cadastrar-flanelinha.tsx`

- [ ] **Step 1: Replace the placeholder**

```typescript
// mobile/app/fiscal/cadastrar-flanelinha.tsx
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
```

- [ ] **Step 2: Verify**

Run from `mobile/`:
```
npx tsc --noEmit
```
Expected: no output (success).

- [ ] **Step 3: Commit**

```bash
git add mobile/app/fiscal/cadastrar-flanelinha.tsx
git commit -m "feat: implement Cadastrar Flanelinha screen"
```

---

### Task 6: Visualizar Flanelinhas (list) screen

**Files:**
- Modify: `mobile/app/fiscal/flanelinhas.tsx`

- [ ] **Step 1: Replace the placeholder**

```typescript
// mobile/app/fiscal/flanelinhas.tsx
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { listFlanelinhas } from "@/api/flanelinha";
import { extractErrorMessage } from "@/api/client";
import { Banner } from "@/components/Banner";
import { colors } from "@/theme/colors";
import type { FlanelinhaDto } from "@/types/flanelinha";

const SUCCESS_MESSAGES: Record<string, string> = {
  cadastroSucesso: "Flanelinha cadastrado com sucesso.",
  edicaoSucesso: "Alterações salvas com sucesso.",
  exclusaoSucesso: "Flanelinha excluído com sucesso.",
};

export default function FlanelinhasScreen() {
  const params = useLocalSearchParams<{
    cadastroSucesso?: string;
    edicaoSucesso?: string;
    exclusaoSucesso?: string;
  }>();

  const [flanelinhas, setFlanelinhas] = useState<FlanelinhaDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const successKey = (["cadastroSucesso", "edicaoSucesso", "exclusaoSucesso"] as const).find(
    (key) => params[key] === "1"
  );
  const successMessage = successKey ? SUCCESS_MESSAGES[successKey] : null;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setIsLoading(true);
      setErrorMessage(null);

      listFlanelinhas()
        .then((data) => {
          if (!cancelled) setFlanelinhas(data);
        })
        .catch((error) => {
          if (!cancelled) setErrorMessage(extractErrorMessage(error));
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }, [])
  );

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

  return (
    <FlatList
      data={flanelinhas}
      keyExtractor={(item) => String(item.idFlanel)}
      contentContainerStyle={styles.container}
      ListHeaderComponent={
        successMessage ? <Banner type="success" message={successMessage} /> : null
      }
      ListEmptyComponent={
        <Text style={styles.emptyText}>Nenhum Flanelinha cadastrado ainda.</Text>
      }
      renderItem={({ item }) => (
        <Pressable
          style={styles.card}
          onPress={() => router.push(`/fiscal/flanelinha/${item.idFlanel}`)}
          accessibilityRole="button"
        >
          <Text style={styles.cardName}>{item.nome}</Text>
          <Text style={styles.cardSubtitle}>{item.pontoAtuacao}</Text>
          <View
            style={[
              styles.badge,
              { backgroundColor: item.ativo ? colors.successBackground : colors.errorBackground },
            ]}
          >
            <Text style={{ color: item.ativo ? colors.success : colors.error, fontSize: 11, fontWeight: "600" }}>
              {item.ativo ? "Ativo" : "Inativo"}
            </Text>
          </View>
        </Pressable>
      )}
    />
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
  emptyText: {
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 24,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  cardName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 6,
  },
});
```

- [ ] **Step 2: Verify**

Run from `mobile/`:
```
npx tsc --noEmit
```
Expected: **one** error, about `router.push(\`/fiscal/flanelinha/${item.idFlanel}\`)` — the typed
route `fiscal/flanelinha/[id]` doesn't exist yet (that's Task 7). This is the same "expected
temporary type error" pattern used in the mobile scaffold plan (e.g. its Task 4) — confirm the
error is specifically about that one route string and nothing else, then proceed; it resolves once
Task 7 creates the file and regenerates typed routes.

- [ ] **Step 3: Commit**

```bash
git add mobile/app/fiscal/flanelinhas.tsx
git commit -m "feat: implement Visualizar Flanelinhas list screen"
```

---

### Task 7: Detalhe/Editar Flanelinha screen

**Files:**
- Create: `mobile/app/fiscal/flanelinha/[id].tsx`

- [ ] **Step 1: Create the screen**

```typescript
// mobile/app/fiscal/flanelinha/[id].tsx
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { deleteFlanelinha, getFlanelinha, updateFlanelinha } from "@/api/flanelinha";
import { extractErrorMessage } from "@/api/client";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { colors } from "@/theme/colors";

export default function FlanelinhaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const flanelId = Number(id);
  const navigation = useNavigation();

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  const loadFlanelinha = useCallback(() => {
    setIsLoading(true);
    setLoadError(null);

    getFlanelinha(flanelId)
      .then((data) => {
        navigation.setOptions({ title: data.nome });
        setCpf(data.cpf);
        setNome(data.nome);
        setEmail(data.email);
        setPontoAtuacao(data.pontoAtuacao);
        setTelefone(data.telefone);
        setAtivo(data.ativo);
      })
      .catch((error) => setLoadError(extractErrorMessage(error)))
      .finally(() => setIsLoading(false));
  }, [flanelId, navigation]);

  useEffect(() => {
    loadFlanelinha();
  }, [loadFlanelinha]);

  async function handleSave() {
    const nomeValue = nome.trim();
    const emailValue = email.trim();
    const pontoAtuacaoValue = pontoAtuacao.trim();
    const telefoneValue = telefone.trim();

    if (!nomeValue || !emailValue || !pontoAtuacaoValue || !telefoneValue) {
      setErrorMessage("Preencha todos os campos");
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      await updateFlanelinha(flanelId, {
        nome: nomeValue,
        email: emailValue,
        pontoAtuacao: pontoAtuacaoValue,
        telefone: telefoneValue,
        ativo,
      });
      router.replace({ pathname: "/fiscal/flanelinhas", params: { edicaoSucesso: "1" } });
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
      setIsSaving(false);
    }
  }

  async function handleConfirmDelete() {
    setDeleteError(null);
    setIsDeleting(true);

    try {
      await deleteFlanelinha(flanelId);
      router.replace({ pathname: "/fiscal/flanelinhas", params: { exclusaoSucesso: "1" } });
    } catch (error) {
      setDeleteError(extractErrorMessage(error));
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
    <ScrollView contentContainerStyle={styles.container}>
      {errorMessage ? <Banner type="error" message={errorMessage} /> : null}

      <Text style={styles.readonlyLabel}>CPF</Text>
      <Text style={styles.readonlyValue}>{cpf}</Text>

      <Input label="Nome" value={nome} onChangeText={setNome} />
      <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Input label="Ponto de Atuação" value={pontoAtuacao} onChangeText={setPontoAtuacao} />
      <Input label="Telefone" value={telefone} onChangeText={setTelefone} keyboardType="phone-pad" />

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Ativo</Text>
        <Switch value={ativo} onValueChange={setAtivo} trackColor={{ true: colors.success }} />
      </View>

      <Button label="Salvar Alterações" onPress={handleSave} loading={isSaving} />
      <View style={styles.deleteButtonSpacing}>
        <Button label="Excluir Flanelinha" variant="secondary" onPress={() => setIsModalVisible(true)} />
      </View>

      <Modal
        visible={isModalVisible}
        title="Excluir Flanelinha"
        onClose={() => setIsModalVisible(false)}
        actions={
          <>
            <Button label="Cancelar" variant="secondary" onPress={() => setIsModalVisible(false)} />
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

Note on `variant="secondary"` for the delete button: the spec's mockup shows it styled distinctly
(red-tinted), but the existing `Button` component only supports `"primary" | "secondary"` (blue
solid / blue outline — no red/danger variant exists). Adding a third variant to the shared
`Button` component for one screen would be disproportionate to this sub-project's scope (same YAGNI
reasoning already applied to skipping a reusable toggle/loading component in the spec) — use
`secondary` as the closest existing option. If the visual distinction turns out to matter once
you see it running, that's a one-line follow-up (add a `"danger"` variant to `Button.tsx`), not a
blocker for this task.

- [ ] **Step 2: Regenerate typed routes**

New dynamic route files require Expo Router to regenerate `.expo/types/router.d.ts` before
`useLocalSearchParams`/`router.push` calls referencing them will type-check — same requirement
discovered in the mobile scaffold sub-project. This has to run **after** the file from Step 1
exists on disk, since Expo scans the actual files under `app/` to generate the types. Run from
`mobile/`:

```bash
rm -rf .expo/types
npx expo customize tsconfig.json
```

(This second command's actual job — customizing `tsconfig.json` — is a no-op if it's already
customized; its real purpose here is the side effect of regenerating `.expo/types/router.d.ts`.
Confirm it doesn't overwrite unrelated content in `tsconfig.json`; if it prompts to overwrite, keep
the existing file's content.)

- [ ] **Step 3: Verify**

Run from `mobile/`:
```
npx tsc --noEmit
```
Expected: no output (success) — this also resolves the temporary error left by Task 6.

- [ ] **Step 4: Commit**

```bash
git add mobile/app/fiscal/flanelinha/
git commit -m "feat: implement Flanelinha detail/edit screen with delete confirmation"
```

---

### Task 8: Atualizar Dados screen

**Files:**
- Modify: `mobile/app/fiscal/perfil.tsx`

- [ ] **Step 1: Replace the placeholder**

```typescript
// mobile/app/fiscal/perfil.tsx
import { useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { changeFiscalPassword, updateFiscalPerfil } from "@/api/fiscal";
import { extractErrorMessage } from "@/api/client";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAuth } from "@/context/AuthContext";
import { colors } from "@/theme/colors";
import type { FiscalPerfil } from "@/types/auth";

export default function FiscalPerfilScreen() {
  const { session, updateProfile } = useAuth();
  const perfil = session?.perfil as FiscalPerfil;

  const [nome, setNome] = useState(perfil.nome);
  const [email, setEmail] = useState(perfil.email);
  const [dadosError, setDadosError] = useState<string | null>(null);
  const [dadosSuccess, setDadosSuccess] = useState<string | null>(null);
  const [isSavingDados, setIsSavingDados] = useState(false);

  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [senhaError, setSenhaError] = useState<string | null>(null);
  const [senhaSuccess, setSenhaSuccess] = useState<string | null>(null);
  const [isSavingSenha, setIsSavingSenha] = useState(false);

  async function handleSaveDados() {
    setDadosSuccess(null);

    const nomeValue = nome.trim();
    const emailValue = email.trim();

    if (!nomeValue || !emailValue) {
      setDadosError("Preencha todos os campos");
      return;
    }

    setDadosError(null);
    setIsSavingDados(true);

    try {
      const updated = await updateFiscalPerfil(perfil.idFiscal, { nome: nomeValue, email: emailValue });
      await updateProfile(updated);
      setDadosSuccess("Dados atualizados com sucesso.");
    } catch (error) {
      setDadosError(extractErrorMessage(error));
    } finally {
      setIsSavingDados(false);
    }
  }

  async function handleChangePassword() {
    setSenhaSuccess(null);

    const senhaAtualValue = senhaAtual.trim();
    const novaSenhaValue = novaSenha.trim();
    const confirmarSenhaValue = confirmarSenha.trim();

    if (!senhaAtualValue || !novaSenhaValue || !confirmarSenhaValue) {
      setSenhaError("Preencha todos os campos");
      return;
    }

    if (novaSenhaValue !== confirmarSenhaValue) {
      setSenhaError("As senhas não coincidem");
      return;
    }

    setSenhaError(null);
    setIsSavingSenha(true);

    try {
      await changeFiscalPassword(perfil.idFiscal, senhaAtualValue, novaSenhaValue);
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarSenha("");
      setSenhaSuccess("Senha alterada com sucesso.");
    } catch (error) {
      setSenhaError(extractErrorMessage(error));
    } finally {
      setIsSavingSenha(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {dadosError ? <Banner type="error" message={dadosError} /> : null}
      {dadosSuccess ? <Banner type="success" message={dadosSuccess} /> : null}

      <Input label="Nome" value={nome} onChangeText={setNome} />
      <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Button label="Salvar Dados" onPress={handleSaveDados} loading={isSavingDados} />

      <Text style={styles.sectionTitle}>Trocar Senha</Text>

      {senhaError ? <Banner type="error" message={senhaError} /> : null}
      {senhaSuccess ? <Banner type="success" message={senhaSuccess} /> : null}

      <Input label="Senha Atual" value={senhaAtual} onChangeText={setSenhaAtual} secureTextEntry />
      <Input label="Nova Senha" value={novaSenha} onChangeText={setNovaSenha} secureTextEntry />
      <Input label="Confirmar Nova Senha" value={confirmarSenha} onChangeText={setConfirmarSenha} secureTextEntry />
      <Button label="Trocar Senha" onPress={handleChangePassword} loading={isSavingSenha} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 20,
    paddingTop: 16,
    marginBottom: 4,
  },
});
```

- [ ] **Step 2: Verify**

Run from `mobile/`:
```
npx tsc --noEmit
```
Expected: no output (success).

- [ ] **Step 3: Commit**

```bash
git add mobile/app/fiscal/perfil.tsx
git commit -m "feat: implement Atualizar Dados screen (profile + password change)"
```

---

### Task 9: Manual verification against the real backend

No new automated tests (established convention). This exercises every scenario from the spec's
verification checklist end to end, on the physical device already set up for this project.

**Files:** none (verification only).

- [ ] **Step 1: Start the backend**

From `api/`: `dotnet run` (confirm Postgres/Docker is running first). Confirm it's listening on
`http://localhost:5093`.

- [ ] **Step 2: Start Metro from this worktree, pointed at the already-installed dev client**

This plan doesn't add any native dependencies, so the dev client APK already installed on the test
phone (from the mobile scaffold sub-project) doesn't need to be rebuilt — only the JS bundle
changes. From `C:\fiscal-flow\mobile`:

```bash
adb reverse tcp:8081 tcp:8081
adb reverse tcp:5093 tcp:5093
npx expo start --port 8081 --dev-client
```

Open the already-installed app on the phone (or relaunch it if already open — it should pick up
the new bundle automatically once Metro is ready).

- [ ] **Step 3: Walk the checklist**

- Home do Fiscal mostra o nome correto e os totais corretos (comparar com a contagem real no
  banco, ex. via `GET /api/flanelinha` com um token de Fiscal).
- Cadastrar Flanelinha com todos os campos vazios → erro client-side, sem chamar a API.
- Cadastrar Flanelinha com CPF já existente → `Banner` vermelho com a mensagem do backend.
- Cadastrar Flanelinha com sucesso → volta pra lista, `Banner` verde, novo item aparece na lista.
- Lista mostra Nome/Ponto de Atuação/status corretamente pra cada Flanelinha cadastrado.
- Tocar num item da lista → abre o detalhe com os dados corretos pré-preenchidos (incluindo o CPF
  correto, somente leitura).
- Editar e salvar → volta pra lista, `Banner` verde, dados atualizados aparecem na lista.
- Alternar Ativo/Inativo no detalhe e salvar → badge correspondente muda na lista.
- Excluir um Flanelinha (confirmando no Modal) → volta pra lista, `Banner` verde, item some da
  lista.
- Cancelar a exclusão no Modal → nada acontece, Flanelinha continua na lista.
- Sair da Home e voltar (trocar de aba no Drawer) → totais da Home continuam corretos mesmo depois
  de cadastrar/editar/excluir um Flanelinha em outra tela (confirma que o `useFocusEffect` da Home
  está funcionando).
- Atualizar Dados do Fiscal (Nome/Email) → `Banner` verde, permanece na tela, nome atualizado
  também aparece na Home (trocar de aba e voltar).
- Trocar senha com "Nova Senha" ≠ "Confirmar" → erro client-side, sem chamar a API.
- Trocar senha com Senha Atual errada → `Banner` vermelho com a mensagem do backend.
- Trocar senha com sucesso → `Banner` verde, consegue fazer logout e login de novo com a nova
  senha.

- [ ] **Step 4: Fix anything broken, then final commit**

If any step above fails, fix the underlying code (not the checklist) and re-run `npx tsc --noEmit`
plus the specific failing scenario before moving on. Once everything passes:

```bash
cd C:\fiscal-flow
git status
```

Confirm nothing is left uncommitted from the tasks above, then this plan is complete.

---

## Merge

Once Task 9 passes, merge `feature/fiscal-flow-screens` into `main` (same process used for the
mobile scaffold sub-project): from the main repo checkout
(`C:\Users\User\Documents\NicolasProjetos\flanelinha-app`), `git merge feature/fiscal-flow-screens`.
