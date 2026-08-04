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
