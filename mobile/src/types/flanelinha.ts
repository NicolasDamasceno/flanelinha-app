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
