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
  updateProfile: (perfil: FiscalPerfil | FlanelinhaPerfil) => Promise<void>;
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

  const value = useMemo(
    () => ({ session, isLoading, login, logout, updateProfile }),
    [session, isLoading, login, logout, updateProfile]
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
