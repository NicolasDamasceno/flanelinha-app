# Flanelinha Flow Screens Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two remaining Flanelinha-facing placeholder screens (Home/Carteira Digital,
Solicitar Carteirinha) with real implementations, and add a third screen (Atualizar Dados) that
didn't exist before — completing the mobile frontend's fourth and final sub-project.

**Architecture:** A new backend endpoint (`GET /api/flanelinha/me`) lets the Flanelinha fetch its
own up-to-date data (including `carterinhas`, which the login response never populates) on every
screen focus, mirroring the "never trust stale session data" pattern already used by the Fiscal
screens. QR codes are generated entirely client-side (pure JS matrix encoding rendered as a grid of
`View`s, no native dependency) and encode only the carteirinha's número.

**Tech Stack:** React Native/Expo Router (existing), ASP.NET Core/EF Core (existing),
`qrcode-generator` (new npm dependency, pure JS, no native linking).

---

## Chunk 1: Backend endpoint and mobile foundations

### Task 1: Backend — `GET /api/flanelinha/me`

**Files:**
- Modify: `api/Controllers/FlanelinhaController.cs`

- [ ] **Step 1: Add the `GetMe` action**

Open `api/Controllers/FlanelinhaController.cs`. Insert this new action directly after the existing
`GetById` method (right before `[HttpPost] Create`):

```csharp
        [HttpGet("me")]
        [Authorize(Roles = "Flanelinha")]
        public async Task<IActionResult> GetMe(CancellationToken ct)
        {
            var flanelinha = await _flanelinhaRepository.GetByIdWithCarterinhasAsync(AuthenticatedId, ct);

            if (flanelinha == null)
            {
                return NotFound();
            }

            return Ok(flanelinha.ToFlanelinhaDto());
        }
```

This reuses `GetByIdWithCarterinhasAsync` (already defined on `IFlanelinhaRepository`, already used
by `GetById` and `RequestCarteira` in this same controller) and `AuthenticatedId` (the private
property already defined at the top of this controller, resolving the caller from the JWT). No new
repository methods, no new DTOs — `ToFlanelinhaDto()` is the same mapper every other action in this
controller already uses.

- [ ] **Step 2: Verify it builds**

Run: `dotnet build` from `api/`
Expected: `Build succeeded. 0 Warning(s) 0 Error(s)`

- [ ] **Step 3: Commit**

```bash
git add api/Controllers/FlanelinhaController.cs
git commit -m "feat: add GET /api/flanelinha/me self-service endpoint"
```

---

### Task 2: Mobile — warning color tokens

**Files:**
- Modify: `mobile/src/theme/colors.ts`

- [ ] **Step 1: Add the `warning`/`warningBackground` pair**

Open `mobile/src/theme/colors.ts`. Add two new keys, following the same dark-text/pale-background
pairing already used by `error`/`errorBackground` and `success`/`successBackground`:

```typescript
export const colors = {
  primary: "#1D4ED8",
  background: "#FFFFFF",
  error: "#DC2626",
  errorBackground: "#FEE2E2",
  success: "#16A34A",
  successBackground: "#DCFCE7",
  warning: "#92400E",
  warningBackground: "#FEF3C7",
  text: "#1F2937",
  textMuted: "#64748B",
  border: "#CBD5E1",
};
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit` from `mobile/`
Expected: no errors (this is an additive change to a plain object literal — nothing consumes these
keys yet, so nothing can break).

- [ ] **Step 3: Commit**

```bash
git add mobile/src/theme/colors.ts
git commit -m "feat: add warning color tokens to design system"
```

---

### Task 3: Mobile — QR code matrix encoding

**Files:**
- Modify: `mobile/package.json` (new dependency)
- Create: `mobile/src/utils/qrcode.ts`

- [ ] **Step 1: Add the `qrcode-generator` dependency**

Run from `mobile/`:

```bash
npm install qrcode-generator
```

This adds a `"qrcode-generator": "^2.0.4"`-style entry to `mobile/package.json`'s `dependencies`.
It's pure JavaScript — no native module, no linking, no dev-client rebuild needed. It ships its own
TypeScript types (do **not** also install `@types/qrcode-generator` — that package is a deprecated
stub that explicitly defers to the library's own types).

- [ ] **Step 2: Write `src/utils/qrcode.ts`**

```typescript
import qrcode from "qrcode-generator";

export function getQrMatrix(value: string): boolean[][] {
  const qr = qrcode(0, "M"); // typeNumber 0 = auto-detecta o menor tamanho necessário
  qr.addData(value);
  qr.make();

  const count = qr.getModuleCount();
  const matrix: boolean[][] = [];
  for (let row = 0; row < count; row++) {
    const rowValues: boolean[] = [];
    for (let col = 0; col < count; col++) {
      rowValues.push(qr.isDark(row, col));
    }
    matrix.push(rowValues);
  }
  return matrix;
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit` from `mobile/`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add mobile/package.json mobile/package-lock.json mobile/src/utils/qrcode.ts
git commit -m "feat: add pure-JS QR code matrix encoding util"
```

---

### Task 4: Mobile — `QrCode` component

**Files:**
- Create: `mobile/src/components/QrCode.tsx`

- [ ] **Step 1: Write the component**

Renders the matrix from Task 3 as a grid of plain `View`s — no SVG, no native dependency.

```typescript
import { View } from "react-native";
import { getQrMatrix } from "@/utils/qrcode";
import { colors } from "@/theme/colors";

interface QrCodeProps {
  value: string;
  size: number;
}

export function QrCode({ value, size }: QrCodeProps) {
  const matrix = getQrMatrix(value);
  const moduleSize = size / matrix.length;

  return (
    <View style={{ width: size, height: size, backgroundColor: colors.background }}>
      {matrix.map((row, rowIndex) => (
        <View key={rowIndex} style={{ flexDirection: "row" }}>
          {row.map((isDark, colIndex) => (
            <View
              key={colIndex}
              style={{
                width: moduleSize,
                height: moduleSize,
                backgroundColor: isDark ? colors.text : colors.background,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit` from `mobile/`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/components/QrCode.tsx
git commit -m "feat: add QrCode component rendering matrix as a View grid"
```

---

### Task 5: Mobile — new `src/api/flanelinha.ts` functions

**Files:**
- Modify: `mobile/src/api/flanelinha.ts`

- [ ] **Step 1: Add the four new functions**

Open `mobile/src/api/flanelinha.ts`. It currently has `listFlanelinhas`, `getFlanelinha`,
`createFlanelinha`, `updateFlanelinha`, `deleteFlanelinha` — all built for the Fiscal side. Add
these four alongside them, and extend the import line for the new types needed:

```typescript
import { apiClient } from "@/api/client";
import type { CarterinhaDto, CreateFlanelinhaDto, FlanelinhaDto, UpdateFlanelinhaDto } from "@/types/flanelinha";
import type { FlanelinhaPerfil } from "@/types/auth";

// ... existing functions unchanged ...

export async function getMyFlanelinha(): Promise<FlanelinhaDto> {
  const response = await apiClient.get<FlanelinhaDto>("/api/flanelinha/me");
  return response.data;
}

export async function requestCarteira(id: number): Promise<CarterinhaDto> {
  const response = await apiClient.post<CarterinhaDto>(`/api/flanelinha/${id}/carteiras`, {});
  return response.data;
}

export async function updatePerfilFlanelinha(
  id: number,
  dto: { nome: string; email: string }
): Promise<FlanelinhaPerfil> {
  const response = await apiClient.put<FlanelinhaPerfil>(`/api/flanelinha/${id}/perfil`, dto);
  return response.data;
}

export async function changeFlanelinhaPassword(
  id: number,
  senhaAtual: string,
  novaSenha: string
): Promise<void> {
  await apiClient.put(`/api/flanelinha/${id}/senha`, { senhaAtual, novaSenha });
}
```

`requestCarteira` sends `{}` as the body — the backend's `RequestCarteiraDto` has no fields, and the
controller action takes it as nullable, so an empty object is sufficient.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit` from `mobile/`
Expected: no errors. (Nothing calls these functions yet — this step only confirms the new code
itself is well-typed.)

- [ ] **Step 3: Commit**

```bash
git add mobile/src/api/flanelinha.ts
git commit -m "feat: add self-service Flanelinha API functions"
```

---

## Chunk 2: Screens and verification

### Task 6: Mobile — Home / Carteira Digital (`flanelinha/home.tsx`)

**Files:**
- Create: `mobile/src/utils/carteira.ts`
- Modify: `mobile/app/flanelinha/home.tsx` (replaces the `PlaceholderScreen` placeholder)

- [ ] **Step 1: Write the shared carteira-selection/formatting helper**

Both this screen and Task 7's screen need to pick the "carteira atual" out of the list `/me` returns,
and both need to format a validity date. This pure logic (no fetching, no state) is small enough to
share directly, unlike the full fetch-and-render pattern (which stays duplicated per the design
doc's scope decision):

```typescript
import type { CarterinhaDto } from "@/types/flanelinha";

export function getCarteiraAtual(carterinhas: CarterinhaDto[]): CarterinhaDto | null {
  if (carterinhas.length === 0) {
    return null;
  }
  return [...carterinhas].sort(
    (a, b) => new Date(b.dataEmissao).getTime() - new Date(a.dataEmissao).getTime()
  )[0];
}

export function isCarteiraVencida(carteira: CarterinhaDto): boolean {
  return new Date(carteira.dataValidade).getTime() <= Date.now();
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}
```

`getCarteiraAtual` doesn't filter on `ativo` the way the backend's `RequestCarteira` does — see the
design doc (`docs/superpowers/specs/2026-08-05-flanelinha-flow-screens-design.md`, section 3.1) for
why that's safe: a new carteira always deactivates the previous one in the same request, so
max-`dataEmissao` and `ativo === true` always agree.

- [ ] **Step 2: Replace the Home placeholder**

Replace the full contents of `mobile/app/flanelinha/home.tsx`:

```typescript
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { getMyFlanelinha } from "@/api/flanelinha";
import { extractErrorMessage } from "@/api/client";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { QrCode } from "@/components/QrCode";
import { colors } from "@/theme/colors";
import type { CarterinhaDto } from "@/types/flanelinha";
import { formatDate, getCarteiraAtual, isCarteiraVencida } from "@/utils/carteira";

export default function FlanelinhaHomeScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pontoAtuacao, setPontoAtuacao] = useState("");
  const [carteiraAtual, setCarteiraAtual] = useState<CarterinhaDto | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setIsLoading(true);
      setErrorMessage(null);

      getMyFlanelinha()
        .then((data) => {
          if (cancelled) return;
          setPontoAtuacao(data.pontoAtuacao);
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

  if (!carteiraAtual) {
    return (
      <View style={styles.container}>
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
      <View style={[styles.card, vencida && styles.cardVencida]}>
        <Text style={styles.cardTitle}>Carteirinha de Flanelinha</Text>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Número</Text>
          <Text style={styles.cardValue}>
            #{String(carteiraAtual.numeroCarterinha).padStart(6, "0")}
          </Text>
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
            <QrCode value={String(carteiraAtual.numeroCarterinha)} size={64} />
          </View>
        </View>
      </View>
      {vencida ? (
        <Button
          label="Solicitar Renovação"
          onPress={() => router.push("/flanelinha/solicitar-carteirinha")}
        />
      ) : null}
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
});
```

Note: the approved mockup used a subtle gradient background on the card. That's out of reach without
a new native dependency (`expo-linear-gradient`), so this uses a flat `colors.background` fill
instead — same border/badge/QR treatment, just without the gradient polish.

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit` from `mobile/`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/utils/carteira.ts mobile/app/flanelinha/home.tsx
git commit -m "feat: implement Flanelinha Home / Carteira Digital screen"
```

---

### Task 7: Mobile — Solicitar Carteirinha (`flanelinha/solicitar-carteirinha.tsx`)

**Files:**
- Modify: `mobile/app/flanelinha/solicitar-carteirinha.tsx` (replaces the `PlaceholderScreen`
  placeholder)

- [ ] **Step 1: Replace the placeholder**

```typescript
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { getMyFlanelinha, requestCarteira } from "@/api/flanelinha";
import { extractErrorMessage } from "@/api/client";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { useAuth } from "@/context/AuthContext";
import { colors } from "@/theme/colors";
import type { FlanelinhaPerfil } from "@/types/auth";
import type { CarterinhaDto } from "@/types/flanelinha";
import { formatDate, getCarteiraAtual, isCarteiraVencida } from "@/utils/carteira";

export default function SolicitarCarteirinhaScreen() {
  const { session } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [carteiraAtual, setCarteiraAtual] = useState<CarterinhaDto | null>(null);

  const [requestError, setRequestError] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setIsLoading(true);
      setLoadError(null);
      setRequestError(null);

      getMyFlanelinha()
        .then((data) => {
          if (cancelled) return;
          setCarteiraAtual(getCarteiraAtual(data.carterinhas));
        })
        .catch((error) => {
          if (!cancelled) setLoadError(extractErrorMessage(error));
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }, [])
  );

  async function handleSolicitar() {
    if (!session) return;
    const idFlanel = (session.perfil as FlanelinhaPerfil).idFlanel;

    setRequestError(null);
    setIsRequesting(true);

    try {
      await requestCarteira(idFlanel);
      router.replace("/flanelinha/home");
    } catch (error) {
      setRequestError(extractErrorMessage(error));
    } finally {
      setIsRequesting(false);
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

  const bloqueado = carteiraAtual != null && !isCarteiraVencida(carteiraAtual);

  return (
    <View style={styles.container}>
      {requestError ? <Banner type="error" message={requestError} /> : null}

      {bloqueado && carteiraAtual ? (
        <>
          <Text style={styles.label}>Sua carteirinha atual:</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Número</Text>
              <Text style={styles.summaryValue}>
                #{String(carteiraAtual.numeroCarterinha).padStart(6, "0")}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Validade</Text>
              <Text style={styles.summaryValue}>{formatDate(carteiraAtual.dataValidade)}</Text>
            </View>
          </View>
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              Sua carteira atual ainda é válida até {formatDate(carteiraAtual.dataValidade)}. Não é
              possível solicitar uma nova até o vencimento.
            </Text>
          </View>
        </>
      ) : null}

      <Button
        label="Solicitar Nova Via"
        onPress={handleSolicitar}
        loading={isRequesting}
        disabled={bloqueado}
      />
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
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 8,
  },
  summaryCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  summaryValue: {
    fontSize: 12,
    color: colors.text,
    fontWeight: "600",
  },
  warningBox: {
    backgroundColor: colors.warningBackground,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    marginBottom: 16,
  },
  warningText: {
    color: colors.warning,
    fontSize: 13,
  },
});
```

The client-side block (`bloqueado`, disabling the button) is a UX nicety, not the only safety net —
`handleSolicitar` still calls the real endpoint and still handles a `400` via `Banner` normally, in
case the client's cached status is stale (e.g. a narrow race window). Note this uses
`!isCarteiraVencida(carteiraAtual)` — the opposite condition from Task 6's `home.tsx`, since "block
the request" and "show the Vencida badge" are inverse conditions of the same validity check.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit` from `mobile/`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/app/flanelinha/solicitar-carteirinha.tsx
git commit -m "feat: implement Solicitar Carteirinha screen with client-side block"
```

---

### Task 8: Mobile — Atualizar Dados screen + drawer entry

**Files:**
- Create: `mobile/app/flanelinha/atualizar-dados.tsx`
- Modify: `mobile/app/flanelinha/_layout.tsx`

- [ ] **Step 1: Write `atualizar-dados.tsx`**

This mirrors `mobile/app/fiscal/perfil.tsx` (already implemented and hardened across several review
rounds in sub-project 3) almost exactly — same two-section structure, same validation, same
banner-timing behavior — with three differences: no Ponto de Atuação/Telefone fields (the backend's
`UpdatePerfilDto` only accepts Nome/Email), `FlanelinhaPerfil`/`idFlanel` instead of
`FiscalPerfil`/`idFiscal`, and `updatePerfilFlanelinha`/`changeFlanelinhaPassword` instead of the
Fiscal equivalents.

```typescript
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { changeFlanelinhaPassword, updatePerfilFlanelinha } from "@/api/flanelinha";
import { extractErrorMessage } from "@/api/client";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAuth } from "@/context/AuthContext";
import { colors } from "@/theme/colors";
import type { FlanelinhaPerfil } from "@/types/auth";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function FlanelinhaAtualizarDadosScreen() {
  const { session, updateProfile } = useAuth();
  // Optional, not cast to a definite FlanelinhaPerfil: same rationale as fiscal/perfil.tsx — this
  // screen stays mounted while the Drawer is alive, and logout() clears the session synchronously
  // before navigating away, so a re-render with session === null is expected here too.
  const perfil = session?.perfil as FlanelinhaPerfil | undefined;

  const [nome, setNome] = useState(perfil?.nome ?? "");
  const [email, setEmail] = useState(perfil?.email ?? "");
  const [dadosError, setDadosError] = useState<{ text: string } | null>(null);
  const [dadosSuccess, setDadosSuccess] = useState<{ text: string } | null>(null);
  const [isSavingDados, setIsSavingDados] = useState(false);

  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [senhaError, setSenhaError] = useState<{ text: string } | null>(null);
  const [senhaSuccess, setSenhaSuccess] = useState<{ text: string } | null>(null);
  const [isSavingSenha, setIsSavingSenha] = useState(false);

  useEffect(() => {
    if (!dadosError) return;
    const timer = setTimeout(() => setDadosError(null), 3000);
    return () => clearTimeout(timer);
  }, [dadosError]);

  useEffect(() => {
    if (!dadosSuccess) return;
    const timer = setTimeout(() => setDadosSuccess(null), 3000);
    return () => clearTimeout(timer);
  }, [dadosSuccess]);

  useEffect(() => {
    if (!senhaError) return;
    const timer = setTimeout(() => setSenhaError(null), 3000);
    return () => clearTimeout(timer);
  }, [senhaError]);

  useEffect(() => {
    if (!senhaSuccess) return;
    const timer = setTimeout(() => setSenhaSuccess(null), 3000);
    return () => clearTimeout(timer);
  }, [senhaSuccess]);

  async function handleSaveDados() {
    if (!perfil) return;

    setDadosSuccess(null);

    const nomeValue = nome.trim();
    const emailValue = email.trim();

    if (!nomeValue || !emailValue) {
      setDadosError({ text: "Preencha todos os campos" });
      return;
    }

    if (!EMAIL_PATTERN.test(emailValue)) {
      setDadosError({ text: "Email inválido" });
      return;
    }

    setDadosError(null);
    setIsSavingDados(true);

    try {
      const updated = await updatePerfilFlanelinha(perfil.idFlanel, {
        nome: nomeValue,
        email: emailValue,
      });
      setDadosSuccess({ text: "Dados atualizados com sucesso." });
      try {
        await updateProfile(updated);
      } catch {
        // Persistência local da sessão falhou; a sessão em memória já foi atualizada e o backend
        // já gravou — não é um erro do ponto de vista do usuário.
      }
    } catch (error) {
      setDadosError({ text: extractErrorMessage(error) });
    } finally {
      setIsSavingDados(false);
    }
  }

  async function handleChangePassword() {
    if (!perfil) return;

    setSenhaSuccess(null);

    const senhaAtualValue = senhaAtual.trim();
    const novaSenhaValue = novaSenha.trim();
    const confirmarSenhaValue = confirmarSenha.trim();

    if (!senhaAtualValue || !novaSenhaValue || !confirmarSenhaValue) {
      setSenhaError({ text: "Preencha todos os campos" });
      return;
    }

    if (novaSenhaValue !== confirmarSenhaValue) {
      setSenhaError({ text: "As senhas não coincidem" });
      return;
    }

    if (novaSenhaValue.length < 6) {
      setSenhaError({ text: "A senha deve ter no mínimo 6 caracteres." });
      return;
    }

    setSenhaError(null);
    setIsSavingSenha(true);

    try {
      await changeFlanelinhaPassword(perfil.idFlanel, senhaAtualValue, novaSenhaValue);
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarSenha("");
      setSenhaSuccess({ text: "Senha alterada com sucesso." });
    } catch (error) {
      setSenhaError({ text: extractErrorMessage(error) });
    } finally {
      setIsSavingSenha(false);
    }
  }

  if (!perfil) {
    return null;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      {dadosError ? <Banner type="error" message={dadosError.text} /> : null}
      {dadosSuccess ? <Banner type="success" message={dadosSuccess.text} /> : null}

      <Input label="Nome" value={nome} onChangeText={setNome} />
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Button label="Salvar Dados" onPress={handleSaveDados} loading={isSavingDados} />

      <Text style={styles.sectionTitle}>Trocar Senha</Text>

      {senhaError ? <Banner type="error" message={senhaError.text} /> : null}
      {senhaSuccess ? <Banner type="success" message={senhaSuccess.text} /> : null}

      <Input
        label="Senha Atual"
        value={senhaAtual}
        onChangeText={setSenhaAtual}
        secureTextEntry
        textContentType="password"
        autoComplete="password"
      />
      <Input
        label="Nova Senha"
        value={novaSenha}
        onChangeText={setNovaSenha}
        secureTextEntry
        textContentType="newPassword"
        autoComplete="new-password"
      />
      <Input
        label="Confirmar Nova Senha"
        value={confirmarSenha}
        onChangeText={setConfirmarSenha}
        secureTextEntry
        textContentType="newPassword"
        autoComplete="new-password"
      />
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

- [ ] **Step 2: Add the drawer entry**

Replace the full contents of `mobile/app/flanelinha/_layout.tsx`:

```typescript
import { Drawer } from "expo-router/drawer";
import { DrawerContent, type DrawerMenuItem } from "@/components/DrawerContent";
import { colors } from "@/theme/colors";

const items: DrawerMenuItem[] = [
  { label: "Início", route: "/flanelinha/home" },
  { label: "Solicitar Carteirinha Nova", route: "/flanelinha/solicitar-carteirinha" },
  { label: "Atualizar Dados", route: "/flanelinha/atualizar-dados" },
];

export default function FlanelinhaLayout() {
  return (
    <Drawer
      drawerContent={() => <DrawerContent items={items} />}
      screenOptions={{ headerTintColor: colors.primary }}
    >
      <Drawer.Screen name="home" options={{ title: "Início" }} />
      <Drawer.Screen name="solicitar-carteirinha" options={{ title: "Solicitar Carteirinha" }} />
      <Drawer.Screen name="atualizar-dados" options={{ title: "Atualizar Dados" }} />
    </Drawer>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit` from `mobile/`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add mobile/app/flanelinha/atualizar-dados.tsx mobile/app/flanelinha/_layout.tsx
git commit -m "feat: implement Flanelinha Atualizar Dados screen"
```

---

### Task 9: Manual verification against the real backend

> **This task needs a human at a physical device — do not assume a subagent can complete it
> unattended.** It requires the .NET backend running locally, a Flanelinha test account logged in
> on the physical Samsung device (custom dev client, already installed from sub-project 2/3 — no
> rebuild needed since Tasks 1-8 added zero native dependencies), and in one case, direct database
> access to backdate a `Carterinha.DataValidade` for the "vencida" scenario.

**Files:** none (verification only)

- [ ] **Step 1: Start the backend**

Run: `dotnet run` from `api/`

- [ ] **Step 2: Walk through the checklist from the design doc**

From `docs/superpowers/specs/2026-08-05-flanelinha-flow-screens-design.md`, section 4:

- Login with a Flanelinha that has no carteirinha yet → Home shows the empty state.
- Solicitar Carteirinha (no carteira yet) → success, back on Home, card shows correct data and a
  visible QR code.
- Solicitar Carteirinha again, now with a valid carteira → screen shows the warning and the button
  is disabled; the button cannot trigger a request.
- Scan the rendered QR code with any QR reader (e.g. another phone's camera) and confirm it decodes
  to the exact carteirinha número shown on the card.
- Backdate `DataValidade` for the active `Carterinha` directly in the database to a past date → Home
  shows the "Vencida" state (red border/badge, dimmed QR) and "Solicitar Renovação" works, issuing a
  new carteira and returning Home to the "Ativa" state.
- Atualizar Dados: change Nome/Email → green Banner, and the updated name is reflected if you
  navigate back to Home.
- Trocar Senha with a correct Senha Atual → green Banner, then log out and log back in with the new
  password to confirm it took effect.
- Trocar Senha with a wrong Senha Atual → red Banner with the backend's error message.
- Confirm `GET /api/flanelinha/me` returns `401` without a token (e.g. via curl/Postman without an
  `Authorization` header) and, with a valid Flanelinha token, never exposes another Flanelinha's
  data (there's no `id` in the route — it can only ever resolve to the token's own owner).

- [ ] **Step 3: Report and fix any issues found**

If any step fails, note the exact reproduction steps, fix the responsible file directly (not via a
new task), re-run `npx tsc --noEmit` / `dotnet build`, re-test that specific step, and commit the
fix separately from the task commits above.
