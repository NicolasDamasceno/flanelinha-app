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
