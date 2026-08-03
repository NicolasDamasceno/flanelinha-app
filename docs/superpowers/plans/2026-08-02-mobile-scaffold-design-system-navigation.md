# Mobile Scaffold + Design System + Navigation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the React Native (Expo) mobile app, build the reusable design system components, and wire up complete role-based navigation (Fiscal/Flanelinha Drawers, login, first-access password change), against the real auth backend from the previous sub-project — per the approved spec at `docs/superpowers/specs/2026-08-02-mobile-scaffold-design-system-navigation-design.md`.

**Architecture:** A new `mobile/` Expo project (TypeScript, Expo Router) sits alongside `api/`. Non-route code lives under `mobile/src/` (api client, auth context, design-system components, theme, types); routes live under `mobile/app/` (Expo Router file-based routing). Session state is a React Context backed by `AsyncStorage`, with a small plain-JS bridge module (`authStore.ts`) so the axios interceptor — which runs outside the React tree — can read the current token and trigger a logout on `401`. Role-specific screens (`fiscal/`, `flanelinha/`) are plain (non-group) folders, each with its own Drawer layout; all their screens are placeholders in this sub-project, replaced with real content in later sub-projects.

**Tech Stack:** Expo SDK 57, React 19.2, React Native 0.86, TypeScript (strict), Expo Router, `@react-navigation/drawer`, axios, `@react-native-async-storage/async-storage`.

**Environment note (verified hands-on before writing this plan):** `expo-router@57.0.9`'s optional `@expo/ui` dependency pulls in web-only Radix UI packages with a peer-dependency conflict that breaks plain `npm install` for anything added afterward. Task 1 adds a `.npmrc` with `legacy-peer-deps=true` as the very first step specifically to avoid this — every subsequent install in this plan (and in later sub-projects) depends on that file already being there.

**Testing approach:** No automated test framework (same decision as the backend sub-project — this is a learning project with no CI). Verification is `npx tsc --noEmit` (fast, per-task) for tasks that don't touch `app/` routes, and `npx expo export --platform android` (slower, but also regenerates Expo Router's typed-routes definitions so subsequent tasks' route references type-check correctly) for any task that adds or changes files under `mobile/app/`. The final task adds real manual testing against the running backend via Expo Go/emulator.

---

## Chunk 1: Scaffold, infrastructure, and API layer

### Task 1: Scaffold the Expo project

**Files:**
- Create: `mobile/` (entire Expo project, via `create-expo-app`)
- Modify: `mobile/package.json`, `mobile/app.json`, `mobile/tsconfig.json`, `mobile/.gitignore`
- Create: `mobile/.npmrc`, `mobile/.env.example`, `mobile/README.md`, `mobile/app/_layout.tsx`,
  `mobile/app/index.tsx`
- Delete: `mobile/App.tsx`, `mobile/index.ts`, `mobile/LICENSE`, `mobile/CLAUDE.md`,
  `mobile/AGENTS.md`, `mobile/.claude/`

- [ ] **Step 1: Scaffold with the minimal TypeScript template**

Run from the repo root (`c:\Users\User\Documents\NicolasProjetos\flanelinha-app\.worktrees\mobile-scaffold`,
if working in the worktree created for this plan):
```
npx create-expo-app@latest mobile --template blank-typescript
```
When prompted `You are creating a project inside of an existing Git repository. Skip initializing
a new git repository?`, answer **Y** (this repo's own git history should be used, not a nested one).

Expected: a `mobile/` folder with `App.tsx`, `index.ts`, `app.json`, `package.json`,
`tsconfig.json`, `assets/`, plus some unrelated scaffolded files (`LICENSE`, `CLAUDE.md`,
`AGENTS.md`, `.claude/`) that get removed in Step 9.

We deliberately use `blank-typescript`, **not** the plain `create-expo-app` default template: the
current default template nests routes under `mobile/src/app/` (not `mobile/app/`) and ships a lot
of unrelated demo/showcase code (animated icons, tab examples, web badges) that has nothing to do
with this app and would all need deleting. `blank-typescript` gives a truly minimal base that we
convert to Expo Router ourselves in the next steps — this matches the file structure in the
approved spec (`mobile/app/...` at the root, not nested under `src/`).

- [ ] **Step 2: Add `.npmrc` before installing anything else**

Create `mobile/.npmrc`:
```
legacy-peer-deps=true
```

This must exist **before** any further `npm`/`expo install` command in this project. Without it,
installing packages after `expo-router` fails with an `ERESOLVE` conflict (verified hands-on):
`expo-router@57.0.9` depends on `@expo/ui`, which pulls in `vaul` and a tree of `@radix-ui/*`
packages requiring a newer `react-dom` than what's pinned elsewhere in the tree. This is a
pre-existing conflict in `expo-router`'s own dependency tree, unrelated to anything this app adds.

- [ ] **Step 3: Install Expo Router and its required peers**

Run from `mobile/`:
```
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
```
Expected: installs succeed (no `ERESOLVE` error, thanks to Step 2), and the console prints
`› Added config plugins: expo-router, expo-status-bar` — `expo install` automatically adds these
to `app.json`'s `plugins` array; don't add them again manually in Step 8.

- [ ] **Step 4: Install navigation, HTTP client, and storage packages**

Run from `mobile/`:
```
npx expo install @react-navigation/drawer axios @react-native-async-storage/async-storage
```

- [ ] **Step 5: Install Drawer's native peer dependencies**

Run from `mobile/`:
```
npx expo install react-native-gesture-handler react-native-reanimated react-native-worklets
```
`react-native-worklets` is required by `react-native-reanimated` v4 in this SDK — verified via
`npx expo-doctor` (it fails with "Missing peer dependency: react-native-worklets" without this
package). `react-native-gesture-handler`/`react-native-reanimated` are required by
`@react-navigation/drawer` and are **not** included by the `blank-typescript` template (unlike the
full default template, which bundles them).

- [ ] **Step 6: Remove the default entry point (replaced by Expo Router)**

```bash
rm mobile/App.tsx mobile/index.ts
```
(PowerShell: `Remove-Item mobile/App.tsx, mobile/index.ts`)

With Expo Router, `expo-router/entry` (set as `package.json`'s `main` in Step 7) becomes the app's
entry point instead of `index.ts` → `App.tsx` → `registerRootComponent`. These two files are no
longer referenced by anything once that change lands, so they're deleted now to avoid confusion.

- [ ] **Step 7: Point `package.json` at the Expo Router entry point**

In `mobile/package.json`, change:
```json
"main": "index.ts",
```
to:
```json
"main": "expo-router/entry",
```
(Leave every dependency/script line exactly as `expo install` left them — don't hand-edit
versions.)

- [ ] **Step 8: Configure `app.json` for Expo Router**

In `mobile/app.json`, inside the `"expo"` object, add two new top-level keys (alongside the
existing `name`, `slug`, `plugins`, etc. — don't remove anything already there):
```json
"scheme": "flanelinha",
"experiments": {
  "typedRoutes": true
}
```

- [ ] **Step 9: Add the `@/*` path alias**

Replace the full contents of `mobile/tsconfig.json`:
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.ts",
    "expo-env.d.ts"
  ]
}
```
This lets every file under `mobile/src/` be imported as `@/api/client`, `@/theme/colors`, etc.,
instead of long relative paths like `../../../src/theme/colors`. Metro (via `expo/metro-config`)
resolves `tsconfig.json` path aliases natively — no extra babel plugin needed (verified hands-on:
the default Expo template already relies on this exact mechanism for its own `@/*` alias).

- [ ] **Step 10: Create the temporary root layout and index route**

Expo Router needs at least one route to bundle successfully, and this task's own verification
(Step 15) needs something real to export. Create a **temporary, minimal** version of each file —
Task 11 (Chunk 3) replaces both with the real implementation (the actual root layout wraps
`AuthProvider`; the actual index route redirects based on session state). Don't build more than
this placeholder here.

Create `mobile/app/_layout.tsx`:
```tsx
import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

Create `mobile/app/index.tsx`:
```tsx
import { Text, View } from "react-native";

export default function Index() {
  return (
    <View>
      <Text>Scaffold OK — replaced in Task 11</Text>
    </View>
  );
}
```

- [ ] **Step 11: Create `.env.example` and ignore `.env`**

Create `mobile/.env.example`:
```
EXPO_PUBLIC_API_URL=http://localhost:5093
```
(`5093` is the real HTTP port from `api/Properties/launchSettings.json`'s `http` profile — works
when running the app in a web browser or iOS simulator on the same machine as the API. Android
emulators need `http://10.0.2.2:5093` instead; a physical device needs the machine's LAN IP. This
is documented in Step 13's README, not hardcoded — different devs/devices need different values.)

Append to `mobile/.gitignore` (the template's default `.gitignore` only ignores `.env*.local`, not
plain `.env` — add a new line, don't remove anything existing):
```
.env
```

- [ ] **Step 12: Remove scaffolded template cruft**

```bash
rm mobile/LICENSE mobile/CLAUDE.md mobile/AGENTS.md
rm -rf mobile/.claude
```
(PowerShell: `Remove-Item mobile/LICENSE, mobile/CLAUDE.md, mobile/AGENTS.md; Remove-Item -Recurse -Force mobile/.claude`)

These come from the current `create-expo-app` template (AI-assistant config files + a generic
license), and don't belong in a subfolder of an existing repo that already has its own `.claude/`
at the root.

- [ ] **Step 13: Write `mobile/README.md`**

Create `mobile/README.md`:
```markdown
# Flanelinha App — Mobile

App React Native (Expo) para Fiscais cadastrarem Flanelinhas e emitirem carteiras digitais.

## Setup

1. `npm install`
2. Copie `.env.example` para `.env` e ajuste `EXPO_PUBLIC_API_URL` para o backend local:
   - Web ou simulador iOS na mesma máquina da API: `http://localhost:5093`
   - Emulador Android: `http://10.0.2.2:5093`
   - Celular físico (mesma rede Wi-Fi da máquina rodando a API): `http://<IP-da-máquina>:5093`
3. Com a API rodando (`dotnet run` em `api/`), inicie o app:
   ```
   npx expo start
   ```
```

- [ ] **Step 14: Verify**

Run from `mobile/`:
```
npx expo-doctor
```
Expected: `18/18 checks passed. No issues detected!`

Run:
```
npx tsc --noEmit
```
Expected: no output (success).

Run:
```
npx expo export --platform android
```
Expected: ends with `Exported: dist` and no errors (this also generates
`.expo/types/router.d.ts`, which later tasks' typed route references depend on — don't skip this
even though `tsc`/`expo-doctor` already passed).

**Known environment warning (not a failure):** if your Node.js version is older than `20.19.4`,
`expo export`/`expo start` will print `Node.js (vX.X.X) is outdated and unsupported` — this was
observed during verification and did **not** prevent a successful export, but if `expo start`
misbehaves later (Task 12), upgrading Node is the first thing to try.

- [ ] **Step 15: Commit**

```bash
git add mobile/
git commit -m "feat: scaffold Expo Router mobile app with core dependencies"
```

---

### Task 2: Theme and API types

**Files:**
- Create: `mobile/src/theme/colors.ts`
- Create: `mobile/src/types/auth.ts`

- [ ] **Step 1: Color palette**

Create `mobile/src/theme/colors.ts`:
```typescript
export const colors = {
  primary: "#1D4ED8",
  background: "#FFFFFF",
  error: "#DC2626",
  errorBackground: "#FEE2E2",
  success: "#16A34A",
  successBackground: "#DCFCE7",
  textMuted: "#64748B",
  border: "#CBD5E1",
};
```

- [ ] **Step 2: Auth-related types**

Create `mobile/src/types/auth.ts`. These mirror `LoginResponseDto`/`FiscalDto`/`FlanelinhaDto` from
the backend exactly (verified against `api/Dtos/Auth/LoginResponseDto.cs`,
`api/Dtos/Fiscal/FiscalDto.cs`, `api/Dtos/Flanelinha/FlanelinhaDto.cs` — ASP.NET Core's default
JSON serialization uses `camelCase`):
```typescript
export type TipoPerfil = "Fiscal" | "Flanelinha";

export interface LoginResponse {
  token: string;
  tipoPerfil: TipoPerfil;
  primeiroAcesso: boolean;
  perfil: FiscalPerfil | FlanelinhaPerfil;
}

export interface FiscalPerfil {
  idFiscal: number;
  nome: string;
  cpf: string;
  email: string;
  dataCriacao: string;
}

export interface FlanelinhaPerfil {
  idFlanel: number;
  nome: string;
  email: string;
  cpf: string;
  pontoAtuacao: string;
  telefone: string;
  ativo: boolean;
  dataCadastro: string;
  idFiscal: number | null;
  carterinhas: unknown[]; // sempre [] na resposta de login (ver plano do auth backend, Task 6)
}
```

- [ ] **Step 3: Verify**

Run from `mobile/`:
```
npx tsc --noEmit
```
Expected: no output (success). These files aren't imported by anything yet, but must still be
valid, self-contained TypeScript.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/theme/colors.ts mobile/src/types/auth.ts
git commit -m "feat: add color palette and auth API types"
```

---

### Task 3: Session bridge and API client

**Files:**
- Create: `mobile/src/context/authStore.ts`
- Create: `mobile/src/api/client.ts`
- Create: `mobile/src/api/auth.ts`

- [ ] **Step 1: Plain-JS session bridge**

Create `mobile/src/context/authStore.ts`. Axios interceptors run outside the React tree and can't
call `useContext`/hooks directly — this tiny module is the bridge: `AuthContext` (Task 4) keeps it
in sync with React state via `useEffect`, and `client.ts`'s interceptors (this task) read/call it
directly.
```typescript
type UnauthorizedHandler = () => void;

let currentToken: string | null = null;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setCurrentToken(token: string | null): void {
  currentToken = token;
}

export function getCurrentToken(): string | null {
  return currentToken;
}

export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  unauthorizedHandler = handler;
}

export function triggerUnauthorized(): void {
  unauthorizedHandler?.();
}
```

- [ ] **Step 2: Axios instance with interceptors and error extraction**

Create `mobile/src/api/client.ts`:
```typescript
import axios from "axios";
import { getCurrentToken, triggerUnauthorized } from "@/context/authStore";

export const LOGIN_PATH = "/api/auth/login";

export const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
});

apiClient.interceptors.request.use((config) => {
  if (config.url !== LOGIN_PATH) {
    const token = getCurrentToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      error.config?.url !== LOGIN_PATH
    ) {
      triggerUnauthorized();
    }
    return Promise.reject(error);
  }
);

const GENERIC_CONNECTION_ERROR = "Não foi possível conectar. Tente novamente.";

export function extractErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error) || !error.response) {
    return GENERIC_CONNECTION_ERROR;
  }

  if (error.response.status >= 500) {
    return GENERIC_CONNECTION_ERROR;
  }

  const data: unknown = error.response.data;

  if (typeof data === "string") {
    return data;
  }

  if (data && typeof data === "object" && "errors" in data) {
    const errors = (data as { errors: Record<string, string[]> }).errors;
    const firstField = Object.values(errors)[0];
    if (firstField && firstField.length > 0) {
      return firstField[0];
    }
  }

  return GENERIC_CONNECTION_ERROR;
}
```

Note: the interceptor checks `error.config?.url !== LOGIN_PATH` (not the full URL with
`baseURL`) — axios's `config.url` is the path exactly as passed to `apiClient.post(...)` in
`auth.ts` (Step 3), i.e. always the relative path, never the full URL, so this string comparison is
reliable regardless of what `EXPO_PUBLIC_API_URL` is set to.

- [ ] **Step 3: Typed auth API functions**

Create `mobile/src/api/auth.ts`:
```typescript
import { apiClient, LOGIN_PATH } from "@/api/client";
import type { LoginResponse } from "@/types/auth";

export async function login(cpf: string, senha: string): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>(LOGIN_PATH, {
    cpf,
    senha,
  });
  return response.data;
}

export async function changePassword(idFlanel: number, novaSenha: string): Promise<void> {
  await apiClient.put(`/api/flanelinha/${idFlanel}/senha`, { novaSenha });
}
```

- [ ] **Step 4: Verify**

Run from `mobile/`:
```
npx tsc --noEmit
```
Expected: no output (success).

- [ ] **Step 5: Commit**

```bash
git add mobile/src/context/authStore.ts mobile/src/api/client.ts mobile/src/api/auth.ts
git commit -m "feat: add axios client with auth interceptors and typed auth API functions"
```

---

### Task 4: `AuthContext`

**Files:**
- Create: `mobile/src/context/AuthContext.tsx`

- [ ] **Step 1: Provider and hook**

Create `mobile/src/context/AuthContext.tsx`:
```tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { login as apiLogin } from "@/api/auth";
import { setCurrentToken, setUnauthorizedHandler } from "@/context/authStore";
import type { FiscalPerfil, FlanelinhaPerfil, LoginResponse, TipoPerfil } from "@/types/auth";

const SESSION_STORAGE_KEY = "@flanelinha:session";

export interface Session {
  token: string;
  tipoPerfil: TipoPerfil;
  perfil: FiscalPerfil | FlanelinhaPerfil;
}

interface AuthContextValue {
  session: Session | null;
  isLoading: boolean;
  login: (cpf: string, senha: string) => Promise<LoginResponse>;
  logout: (params?: Record<string, string>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function toSession(response: LoginResponse): Session {
  return {
    token: response.token,
    tipoPerfil: response.tipoPerfil,
    perfil: response.perfil,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(SESSION_STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          setSession(JSON.parse(raw) as Session);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    setCurrentToken(session?.token ?? null);
  }, [session]);

  const logout = useCallback(async (params?: Record<string, string>) => {
    setSession(null);
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
    router.replace({ pathname: "/login", params: params ?? {} });
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  const login = useCallback(async (cpf: string, senha: string) => {
    const response = await apiLogin(cpf, senha);
    const newSession = toSession(response);
    setSession(newSession);
    await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
    return response;
  }, []);

  const value = useMemo(
    () => ({ session, isLoading, login, logout }),
    [session, isLoading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
```

Note on `logout(params?)`: it accepts an optional params object so callers can control what lands
in the URL after the forced navigation to `/login` — the plain "Sair" button (Task 6, already
written) calls `logout()` with no arguments (plain `/login`); the automatic 401 handler (via
`setUnauthorizedHandler(logout)` above) also calls it with no arguments; the Alterar Senha screen
(Task 10) calls `logout({ senhaAlterada: "1" })` so the success banner shows up on the Login screen
it lands on. Bundling the state-clearing and the navigation into one atomic function (rather than
having each caller do `await logout(); router.replace(...)` separately) avoids a real race: two
separate `router.replace` calls in quick succession can let the first one's target screen commit a
render before the second overwrites it, causing a visible flicker.

Also note: `router.replace({ pathname: "/login", ... })` as a literal is still type-checked against
the `Href` union generated from the routes that exist *at the time `tsc`/`expo export` runs*. Since
`/login` doesn't exist yet, this line is expected to fail type-checking until Task 9 creates
`app/(auth)/login.tsx`. This is a deliberate, temporary gap — call it out explicitly in Step 2
below rather than trying to avoid it.

- [ ] **Step 2: Confirm the expected temporary type error**

Run from `mobile/`:
```
npx tsc --noEmit
```
Expected: **FAILS** with an error on the `router.replace({ pathname: "/login", ... })` line in
`AuthContext.tsx` (a `pathname` type-mismatch error, since no route at `/login` exists yet). This
is expected — resolved in Task 9. Do not work around this by loosening the type (e.g. casting to
`any`) — the whole point of `typedRoutes` is to catch typos in route paths, and this specific
failure is a known, temporary gap the plan already accounts for.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/context/AuthContext.tsx
git commit -m "feat: add AuthContext with AsyncStorage-backed session persistence"
```

---

## Chunk 2: Design system components and Drawer

### Task 5: `Button`, `Input`, `Banner`, `Modal`, `PlaceholderScreen`

**Files:**
- Create: `mobile/src/components/Button.tsx`
- Create: `mobile/src/components/Input.tsx`
- Create: `mobile/src/components/Banner.tsx`
- Create: `mobile/src/components/Modal.tsx`
- Create: `mobile/src/components/PlaceholderScreen.tsx`

None of these five components depend on each other or on anything from Tasks 1-4 except
`theme/colors.ts` — safe to build in one task.

- [ ] **Step 1: `Button`**

Create `mobile/src/components/Button.tsx`:
```tsx
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { colors } from "@/theme/colors";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  loading?: boolean;
  disabled?: boolean;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.base,
        variant === "primary" ? styles.primary : styles.secondary,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.background : colors.primary} />
      ) : (
        <Text style={variant === "primary" ? styles.primaryText : styles.secondaryText}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  disabled: {
    opacity: 0.5,
  },
  primaryText: {
    color: colors.background,
    fontWeight: "600",
    fontSize: 16,
  },
  secondaryText: {
    color: colors.primary,
    fontWeight: "600",
    fontSize: 16,
  },
});
```

- [ ] **Step 2: `Input`**

Create `mobile/src/components/Input.tsx`:
```tsx
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors } from "@/theme/colors";

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
}

export function Input({ label, error, style, ...rest }: InputProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null, style]}
        placeholderTextColor={colors.textMuted}
        {...rest}
      />
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
    color: "#1F2937",
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    marginTop: 4,
  },
});
```

- [ ] **Step 3: `Banner`**

Create `mobile/src/components/Banner.tsx`:
```tsx
import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/colors";

interface BannerProps {
  type: "error" | "success";
  message: string;
}

export function Banner({ type, message }: BannerProps) {
  const isError = type === "error";

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isError ? colors.errorBackground : colors.successBackground },
      ]}
    >
      <Text style={{ color: isError ? colors.error : colors.success }}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
});
```

- [ ] **Step 4: `Modal`**

Create `mobile/src/components/Modal.tsx`. Renamed import (`Modal as RNModal`) avoids a name clash
with this file's own exported `Modal` component:
```tsx
import type { ReactNode } from "react";
import { Modal as RNModal, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/colors";

interface ModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
}

export function Modal({ visible, title, onClose, children, actions }: ModalProps) {
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.content}>{children}</View>
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 400,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  content: {
    marginBottom: 16,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
});
```

- [ ] **Step 5: `PlaceholderScreen`**

Create `mobile/src/components/PlaceholderScreen.tsx`. Not in the original spec's component list —
added here because the spec's folder structure (section 2) calls for 6 near-identical "Em
construção" placeholder route files (`fiscal/home`, `fiscal/cadastrar-flanelinha`,
`fiscal/flanelinhas`, `fiscal/perfil`, `flanelinha/home`, `flanelinha/solicitar-carteirinha`);
sharing one component avoids duplicating the same JSX six times:
```tsx
import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/colors";

interface PlaceholderScreenProps {
  title: string;
}

export function PlaceholderScreen({ title }: PlaceholderScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>Em construção</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
  },
});
```

- [ ] **Step 6: Verify**

Run from `mobile/`:
```
npx tsc --noEmit
```
Expected: **still fails** with the same single `router.replace(...)` (targeting `/login`) error from Task 4 — no
new errors should appear. Confirm the error output is identical to Task 4 Step 2's (same file,
same line, same message) before proceeding.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/components/Button.tsx mobile/src/components/Input.tsx mobile/src/components/Banner.tsx mobile/src/components/Modal.tsx mobile/src/components/PlaceholderScreen.tsx
git commit -m "feat: add Button, Input, Banner, Modal, and PlaceholderScreen components"
```

---

### Task 6: `DrawerContent`

**Files:**
- Create: `mobile/src/components/DrawerContent.tsx`

- [ ] **Step 1: Custom drawer content**

Create `mobile/src/components/DrawerContent.tsx`. Deliberately built with plain React Native
components (not `DrawerContentScrollView`/`DrawerItem` from `@react-navigation/drawer`) — this
avoids depending on that library's own prop-shape contract for custom drawer content, while still
using `@react-navigation/drawer` (via `expo-router/drawer`, Task 7/8) for the actual Drawer
navigator/gestures/animations, which is what it's installed for:
```tsx
import { router, type Href } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { colors } from "@/theme/colors";

export interface DrawerMenuItem {
  label: string;
  route: Href;
}

interface DrawerContentProps {
  items: DrawerMenuItem[];
}

export function DrawerContent({ items }: DrawerContentProps) {
  const { logout } = useAuth();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {items.map((item) => (
        <Pressable
          key={item.route.toString()}
          style={styles.item}
          onPress={() => router.push(item.route)}
        >
          <Text style={styles.itemLabel}>{item.label}</Text>
        </Pressable>
      ))}
      <Pressable style={styles.item} onPress={() => logout()}>
        <Text style={[styles.itemLabel, styles.logoutLabel]}>Sair</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  item: {
    paddingVertical: 14,
  },
  itemLabel: {
    fontSize: 16,
    color: "#1F2937",
  },
  logoutLabel: {
    color: colors.error,
    fontWeight: "600",
  },
});
```

`items` never includes a "Sair" entry — `DrawerContent` always renders it itself, as the last
item, regardless of what's passed in (per the spec: Fiscal's 4 items + this = 5 total in its
Drawer; Flanelinha's 2 items + this = 3 total).

- [ ] **Step 2: Verify**

Run from `mobile/`:
```
npx tsc --noEmit
```
Expected: **still fails** with only the same `router.replace(...)` (targeting `/login`) error from
Task 4 (this file doesn't add any new errors — `Href` typing on `DrawerMenuItem.route` is satisfied by whatever
callers pass, checked when Tasks 7/8 create those callers).

- [ ] **Step 3: Commit**

```bash
git add mobile/src/components/DrawerContent.tsx
git commit -m "feat: add custom DrawerContent component"
```

---

## Chunk 3: Screens and navigation

From this point on, tasks add or change files under `mobile/app/` — verification switches from
`npx tsc --noEmit` to `npx expo export --platform android`, which also regenerates
`.expo/types/router.d.ts` (the typed-routes definitions). Without this regeneration step, a task
that both creates a new route *and* references it elsewhere in the same task could show a false
`tsc` failure against the stale types snapshot from Task 1.

### Task 7: Fiscal Drawer and placeholder screens

**Files:**
- Create: `mobile/app/fiscal/_layout.tsx`
- Create: `mobile/app/fiscal/home.tsx`
- Create: `mobile/app/fiscal/cadastrar-flanelinha.tsx`
- Create: `mobile/app/fiscal/flanelinhas.tsx`
- Create: `mobile/app/fiscal/perfil.tsx`

- [ ] **Step 1: Drawer layout**

Create `mobile/app/fiscal/_layout.tsx`:
```tsx
import { Drawer } from "expo-router/drawer";
import { DrawerContent, type DrawerMenuItem } from "@/components/DrawerContent";

const items: DrawerMenuItem[] = [
  { label: "Início", route: "/fiscal/home" },
  { label: "Cadastrar Flanelinha", route: "/fiscal/cadastrar-flanelinha" },
  { label: "Visualizar Flanelinhas", route: "/fiscal/flanelinhas" },
  { label: "Atualizar Dados", route: "/fiscal/perfil" },
];

export default function FiscalLayout() {
  return (
    <Drawer drawerContent={() => <DrawerContent items={items} />}>
      <Drawer.Screen name="home" options={{ title: "Início" }} />
      <Drawer.Screen name="cadastrar-flanelinha" options={{ title: "Cadastrar Flanelinha" }} />
      <Drawer.Screen name="flanelinhas" options={{ title: "Flanelinhas" }} />
      <Drawer.Screen name="perfil" options={{ title: "Meus Dados" }} />
    </Drawer>
  );
}
```

- [ ] **Step 2: Four placeholder screens**

Create `mobile/app/fiscal/home.tsx`:
```tsx
import { PlaceholderScreen } from "@/components/PlaceholderScreen";

export default function FiscalHomeScreen() {
  return <PlaceholderScreen title="Início" />;
}
```

Create `mobile/app/fiscal/cadastrar-flanelinha.tsx`:
```tsx
import { PlaceholderScreen } from "@/components/PlaceholderScreen";

export default function CadastrarFlanelinhaScreen() {
  return <PlaceholderScreen title="Cadastrar Flanelinha" />;
}
```

Create `mobile/app/fiscal/flanelinhas.tsx`:
```tsx
import { PlaceholderScreen } from "@/components/PlaceholderScreen";

export default function FlanelinhasScreen() {
  return <PlaceholderScreen title="Flanelinhas" />;
}
```

Create `mobile/app/fiscal/perfil.tsx`:
```tsx
import { PlaceholderScreen } from "@/components/PlaceholderScreen";

export default function FiscalPerfilScreen() {
  return <PlaceholderScreen title="Meus Dados" />;
}
```

- [ ] **Step 3: Verify**

Run from `mobile/`:
```
npx expo export --platform android
```
Expected: ends with `Exported: dist`, no errors. This regenerates the route types, so the
`router.replace(...)` (targeting `/login`) error from Task 4 will **still be present** (`/login` genuinely doesn't
exist yet) — confirm the export output calls out that specific error and no others (`expo export`
reports TypeScript errors inline if `tsc` would fail, but still completes the JS bundle since
Metro itself doesn't type-check; if it reports *additional* errors beyond the known
`/login` one, stop and fix them before continuing).

- [ ] **Step 4: Commit**

```bash
git add mobile/app/fiscal/
git commit -m "feat: add Fiscal Drawer layout and placeholder screens"
```

---

### Task 8: Flanelinha Drawer and placeholder screens

**Files:**
- Create: `mobile/app/flanelinha/_layout.tsx`
- Create: `mobile/app/flanelinha/home.tsx`
- Create: `mobile/app/flanelinha/solicitar-carteirinha.tsx`

- [ ] **Step 1: Drawer layout**

Create `mobile/app/flanelinha/_layout.tsx`:
```tsx
import { Drawer } from "expo-router/drawer";
import { DrawerContent, type DrawerMenuItem } from "@/components/DrawerContent";

const items: DrawerMenuItem[] = [
  { label: "Início", route: "/flanelinha/home" },
  { label: "Solicitar Carteirinha Nova", route: "/flanelinha/solicitar-carteirinha" },
];

export default function FlanelinhaLayout() {
  return (
    <Drawer drawerContent={() => <DrawerContent items={items} />}>
      <Drawer.Screen name="home" options={{ title: "Início" }} />
      <Drawer.Screen name="solicitar-carteirinha" options={{ title: "Solicitar Carteirinha" }} />
    </Drawer>
  );
}
```

- [ ] **Step 2: Two placeholder screens**

Create `mobile/app/flanelinha/home.tsx`:
```tsx
import { PlaceholderScreen } from "@/components/PlaceholderScreen";

export default function FlanelinhaHomeScreen() {
  return <PlaceholderScreen title="Carteira Digital" />;
}
```

Create `mobile/app/flanelinha/solicitar-carteirinha.tsx`:
```tsx
import { PlaceholderScreen } from "@/components/PlaceholderScreen";

export default function SolicitarCarteirinhaScreen() {
  return <PlaceholderScreen title="Solicitar Carteirinha Nova" />;
}
```

- [ ] **Step 3: Verify**

Run from `mobile/`:
```
npx expo export --platform android
```
Expected: same as Task 7 Step 3 — ends with `Exported: dist`, only the known
`router.replace(...)` (targeting `/login`) error, nothing new.

- [ ] **Step 4: Commit**

```bash
git add mobile/app/flanelinha/
git commit -m "feat: add Flanelinha Drawer layout and placeholder screens"
```

---

### Task 9: Login screen

**Files:**
- Create: `mobile/app/(auth)/login.tsx`

- [ ] **Step 1: Login screen**

Create `mobile/app/(auth)/login.tsx`. `(auth)` is a route group (parentheses excluded from the
URL), so this file's route is `/login`, not `/(auth)/login` — see the spec's note in section 2 on
why `fiscal`/`flanelinha` can't also be groups, but `(auth)` can (no name collision):
```tsx
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { extractErrorMessage } from "@/api/client";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAuth } from "@/context/AuthContext";

export default function LoginScreen() {
  const { login } = useAuth();
  const params = useLocalSearchParams<{ senhaAlterada?: string }>();

  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(
    params.senhaAlterada === "1" ? "Senha alterada com sucesso. Faça login novamente." : null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setSuccessMessage(null);

    if (!cpf.trim() || !senha.trim()) {
      setErrorMessage("Preencha todos os campos");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await login(cpf, senha);

      if (response.tipoPerfil === "Flanelinha" && response.primeiroAcesso) {
        router.replace("/alterar-senha");
        return;
      }

      router.replace(response.tipoPerfil === "Fiscal" ? "/fiscal/home" : "/flanelinha/home");
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Entrar</Text>

      {errorMessage ? <Banner type="error" message={errorMessage} /> : null}
      {successMessage ? <Banner type="success" message={successMessage} /> : null}

      <Input label="CPF" value={cpf} onChangeText={setCpf} keyboardType="numeric" />
      <Input label="Senha" value={senha} onChangeText={setSenha} secureTextEntry />

      <Button label="Entrar" onPress={handleSubmit} loading={isSubmitting} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 24,
  },
});
```

- [ ] **Step 2: Verify — this resolves the known error, but introduces one new expected one**

Run from `mobile/`:
```
npx expo export --platform android
```
Expected: the `router.replace(...)` (targeting `/login`) error from Task 4 (`AuthContext.tsx`) is now **gone** —
`/login` exists as of this task. A **new**, equally expected error takes its place: this file's own
`router.replace("/alterar-senha")` line, because `app/(auth)/alterar-senha.tsx` doesn't exist yet.
Confirm the export output shows exactly this one error, on this file, nothing else — resolved in
Task 10.

- [ ] **Step 3: Commit**

```bash
git add "mobile/app/(auth)/login.tsx"
git commit -m "feat: add login screen"
```

---

### Task 10: Alterar Senha screen (first-access password change)

**Files:**
- Create: `mobile/app/(auth)/alterar-senha.tsx`

- [ ] **Step 1: Alterar Senha screen**

Create `mobile/app/(auth)/alterar-senha.tsx`. Route: `/alterar-senha` (same `(auth)` group as
`login.tsx`). Only reachable from `login.tsx`'s primeiro-acesso branch (Task 9) — there is no link
to it from any Drawer or other screen, matching the spec:
```tsx
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { changePassword } from "@/api/auth";
import { extractErrorMessage } from "@/api/client";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAuth } from "@/context/AuthContext";
import type { FlanelinhaPerfil } from "@/types/auth";

export default function AlterarSenhaScreen() {
  const { session, logout } = useAuth();

  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!session) {
      return;
    }

    if (!novaSenha.trim() || !confirmarSenha.trim()) {
      setErrorMessage("Preencha todos os campos");
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setErrorMessage("As senhas não coincidem");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      // Esta tela só é alcançada a partir do login de um Flanelinha em primeiro acesso
      // (app/(auth)/login.tsx), então session.perfil é sempre um FlanelinhaPerfil aqui.
      const { idFlanel } = session.perfil as FlanelinhaPerfil;
      await changePassword(idFlanel, novaSenha);
      await logout({ senhaAlterada: "1" });
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Alterar Senha</Text>
      <Text style={styles.subtitle}>
        Este é seu primeiro acesso. Defina uma nova senha para continuar.
      </Text>

      {errorMessage ? <Banner type="error" message={errorMessage} /> : null}

      <Input label="Nova Senha" value={novaSenha} onChangeText={setNovaSenha} secureTextEntry />
      <Input
        label="Confirmar Nova Senha"
        value={confirmarSenha}
        onChangeText={setConfirmarSenha}
        secureTextEntry
      />

      <Button label="Salvar" onPress={handleSubmit} loading={isSubmitting} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 24,
  },
});
```

Note: `setIsSubmitting(false)` is only called in the `catch` branch, not in a `finally` — on
success, `logout()` immediately navigates away from this screen, so resetting `isSubmitting` after
that would either be a no-op or (worse) briefly re-enable the button on a screen that's about to
unmount. This mirrors the same reasoning as the `RequestCarteira`-style flows in the backend: don't
reset UI state that no longer matters once navigation has already happened.

- [ ] **Step 2: Verify — all known temporary errors should be resolved now**

Run from `mobile/`:
```
npx expo export --platform android
```
Expected: ends with `Exported: dist`, **zero** TypeScript errors — this is the first task where
the whole app should type-check cleanly end to end. If you still see an error mentioning `/login`
or `/alterar-senha`, stop and check `logout`'s signature in `AuthContext.tsx` (Task 4) matches
exactly what's shown there (`(params?: Record<string, string>) => Promise<void>`).

- [ ] **Step 3: Commit**

```bash
git add "mobile/app/(auth)/alterar-senha.tsx"
git commit -m "feat: add first-access password change screen"
```

---

### Task 11: Real root layout and redirect logic

**Files:**
- Modify: `mobile/app/_layout.tsx`
- Modify: `mobile/app/index.tsx`

Replaces the temporary stub versions of both files from Task 1 Step 10 with the real
implementation described in the spec (section 3).

- [ ] **Step 1: Root layout wraps `AuthProvider`**

Replace the full contents of `mobile/app/_layout.tsx`:
```tsx
import { Stack } from "expo-router";
import { AuthProvider } from "@/context/AuthContext";

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
```

- [ ] **Step 2: Index route decides where to land**

Replace the full contents of `mobile/app/index.tsx`:
```tsx
import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { colors } from "@/theme/colors";

export default function Index() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  return <Redirect href={session.tipoPerfil === "Fiscal" ? "/fiscal/home" : "/flanelinha/home"} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
```

`useAuth()` works here because `index.tsx` renders as a child of the `<Stack />` inside
`<AuthProvider>` from `_layout.tsx` (Step 1) — every screen in the app is a descendant of that
provider.

- [ ] **Step 3: Verify**

Run from `mobile/`:
```
npx expo export --platform android
```
Expected: ends with `Exported: dist`, zero errors.

Run:
```
npx expo-doctor
```
Expected: `18/18 checks passed. No issues detected!`

- [ ] **Step 4: Commit**

```bash
git add mobile/app/_layout.tsx mobile/app/index.tsx
git commit -m "feat: wire AuthProvider and session-based redirect at app root"
```

---

### Task 12: Manual verification against the real backend

**Files:** none (verification only)

Runs the full checklist from the spec's section 6. Uses Expo Go or an Android emulator — **not**
`npx expo start --web`. This was corrected during plan review: the backend (`api/Program.cs`) has
no CORS middleware configured at all, and a browser talking to a different-origin API sends a
CORS preflight (`OPTIONS`) before every `POST`/`PUT` that axios makes here — with no
`Access-Control-Allow-Origin` response, every single request in this checklist would be blocked by
the browser, surfacing as `extractErrorMessage`'s generic connection-error banner instead of the
specific outcomes below. This is exactly why the spec's "Fora de escopo" section rules out Expo
Web for this app: native clients (Expo Go, an emulator) issue plain HTTP requests with no CORS
enforcement at all, so this isn't a workaround — it's the only path that was ever in scope.

- [ ] **Step 1: Set up `.env` for your target**

From `mobile/`:
```bash
cp .env.example .env
```
(PowerShell: `Copy-Item .env.example .env`). Then edit `EXPO_PUBLIC_API_URL` in `.env` based on
what you'll run against:
- **Android emulator**: `http://10.0.2.2:5093` (the emulator's alias for the host machine's
  `localhost` — `http://localhost:5093` from inside the emulator would point at the emulator
  itself, not your machine).
- **Physical device via Expo Go, same Wi-Fi as this machine**: `http://<LAN-IP-desta-máquina>:5093`
  — find the IP with `ipconfig` (look for the `IPv4 Address` under your active network adapter,
  e.g. `192.168.1.42`). `localhost`/`10.0.2.2` won't work from a separate physical device.

- [ ] **Step 2: Start the backend**

In a separate terminal, from `api/`:
```
dotnet run
```
Expected: `Now listening on: http://localhost:5093` (and an `https://localhost:7104` line — ignore
it, the mobile app talks to the `http` port only, per the spec). Leave running.

Confirm the database has the `UniqueCpfIndex` migration applied (from the auth backend
sub-project) — if unsure, run `dotnet ef database update` from `api/` in another terminal; `Done.`
or no pending migrations either way means you're set.

- [ ] **Step 3: Ensure test accounts exist**

These `curl` commands run from this machine's own terminal against `localhost` (not from inside an
emulator/device) — they're independent of whatever `EXPO_PUBLIC_API_URL` you set in Step 1. In
PowerShell, `curl` only accepts the `-d "{\"key\":...}"` escaped-quote syntax shown below if it
resolves to the real `curl.exe` and not PowerShell's `Invoke-WebRequest` alias — run `Get-Command
curl` first to check; if it resolves to the alias, either use `curl.exe` explicitly or run these
from Git Bash instead.

If you don't already have a Fiscal and a first-access Flanelinha in your local database (e.g. from
the auth backend sub-project's own manual verification), create them:
```
curl -X POST http://localhost:5093/api/fiscal -H "Content-Type: application/json" -d "{\"nome\":\"Fiscal Teste\",\"cpf\":\"11111111111\",\"email\":\"fiscal@teste.com\",\"senha\":\"SenhaFiscal123\"}"
```
Expected: `201 Created` (or `409`/`400` if a Fiscal with this CPF already exists — that's fine,
reuse it). If this fails with `401 Unauthorized` because `POST /api/fiscal` is now
`[Authorize(Roles = "Fiscal")]`-protected and you have no Fiscal at all yet, this is the same
bootstrap situation the auth backend plan's own Task 11 covers — get a token some other way (e.g.
a Fiscal already in the database from that plan's verification) or temporarily relax the attribute,
exactly as described there.
```
curl -X POST http://localhost:5093/api/auth/login -H "Content-Type: application/json" -d "{\"cpf\":\"11111111111\",\"senha\":\"SenhaFiscal123\"}"
```
Copy the `token` from the response, then:
```
curl -X POST http://localhost:5093/api/flanelinha -H "Authorization: Bearer <token-do-fiscal>" -H "Content-Type: application/json" -d "{\"nome\":\"Flanelinha Teste\",\"email\":\"flanelinha@teste.com\",\"cpf\":\"33333333333\",\"pontoAtuacao\":\"Praca Central\",\"telefone\":\"86999999999\",\"ativo\":true,\"senha\":\"SenhaFlanel123\"}"
```
(Using a fresh CPF `33333333333` here, distinct from the auth backend plan's own test data, avoids
depending on whether that plan's Flanelinha still has `primeiroAcesso: true` — a Flanelinha that's
already changed its password once won't trigger the first-access flow this task needs to exercise.)

- [ ] **Step 4: Start the mobile app**

From `mobile/`:
```
npx expo start
```
Expected: Metro bundles successfully and prints a QR code plus a menu of options. Then, depending
on your target:
- **Android emulator**: with an emulator already running (via Android Studio), press `a` in the
  terminal running `expo start`. Expo installs Expo Go on the emulator automatically if needed and
  opens the app.
- **Physical device**: install the "Expo Go" app from the Play Store/App Store, then scan the
  printed QR code with it (Android: Expo Go's built-in scanner; iOS: the system Camera app).

If neither an emulator nor a physical device is available in your environment, this step (and the
rest of this task) can't run — report that clearly rather than falling back to `--web`, which
cannot exercise this checklist correctly (see the CORS explanation at the top of this task).

- [ ] **Step 5: Walk through the checklist**

- App opens with no saved session → lands on the Login screen.
- Submit the login form with either field empty → red `Banner` "Preencha todos os campos", no
  network request made.
- Log in with the Fiscal's CPF/senha (`11111111111` / `SenhaFiscal123`) → lands on
  `/fiscal/home` (a "Início — Em construção" placeholder), and opening the Drawer (swipe from the
  left edge, or tap the hamburger icon if the header is visible) shows 5 items: Início, Cadastrar
  Flanelinha, Visualizar Flanelinhas, Atualizar Dados, Sair.
- Tap "Sair" → back to Login. Force-close and reopen the app → still on Login (no session
  persisted after logout).
- Log in with a wrong password for the Fiscal → red `Banner` "CPF ou senha inválidos." (note the
  trailing period — that's the literal text `AuthController.InvalidCredentialsMessage` returns),
  stays on Login.
- Log in with the Flanelinha's CPF/senha (`33333333333` / `SenhaFlanel123`, first access) → lands
  on the Alterar Senha screen, **not** `/flanelinha/home`.
- On Alterar Senha, enter two different values in "Nova Senha"/"Confirmar Nova Senha" → red
  `Banner` "As senhas não coincidem", no network request made.
- Enter matching values (e.g. `NovaSenha456` in both) and submit → redirected to Login with a
  green `Banner` "Senha alterada com sucesso. Faça login novamente."
- Log in again with the Flanelinha's CPF and the **new** password (`NovaSenha456`) → lands on
  `/flanelinha/home` directly (no more Alterar Senha — `primeiroAcesso` is now `false`). Opening
  the Drawer shows 3 items: Início, Solicitar Carteirinha Nova, Sair.
- Force-close and reopen the app while still logged in as the Flanelinha → still lands on
  `/flanelinha/home` directly, without showing Login first (session persisted via `AsyncStorage`).
- Tap "Sair" → back to Login.

- [ ] **Step 6: `Modal` smoke check**

`Modal` has no real consumer yet in this sub-project (per the spec, it's a base for sub-projects
3/4). Confirm it at least renders correctly: temporarily add a `Button` + `Modal` pair to
`mobile/app/fiscal/home.tsx` (e.g. a button that sets `visible` state to `true`, and a `Modal`
with a title, some text as `children`, and a "Fechar" `Button` as `actions` that sets `visible`
back to `false`), reload, log in as the Fiscal, and confirm: tapping the button opens the modal
centered over a dimmed background, showing the title/content/action button, and tapping "Fechar"
(or the Android hardware/gesture back action, `onRequestClose`) closes it. Once confirmed,
**revert** `fiscal/home.tsx` back to the plain `PlaceholderScreen` from Task 7 — this was only a
temporary smoke check, not a real feature.

- [ ] **Step 7: Stop everything**

Stop the Expo dev server (Ctrl+C) and the `dotnet run` process (Ctrl+C in its terminal).

- [ ] **Step 8: Final commit (if Step 6 left anything behind)**

```bash
git status
```
Expected: clean relative to Task 11's commit (Step 6 explicitly reverts its own temporary change).
If `fiscal/home.tsx` shows as modified, that revert didn't happen — restore it to the
`PlaceholderScreen`-only version from Task 7 before finishing.
