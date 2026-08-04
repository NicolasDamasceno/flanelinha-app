# Design: Fluxo de Telas do Fiscal

## Contexto

Este é o terceiro de quatro sub-projetos da camada de frontend mobile (auth backend → scaffold +
design system + navegação → **fluxo Fiscal** → fluxo Flanelinha). O segundo sub-projeto
(`2026-08-02-mobile-scaffold-design-system-navigation-design.md`, já mergeado em `main`) entregou o
projeto Expo completo, o design system (`Button`, `Input`, `Banner`, `Modal`, `PlaceholderScreen`),
a navegação (Drawer por perfil) e o fluxo de autenticação — mas as quatro rotas do Fiscal
(`fiscal/home.tsx`, `fiscal/cadastrar-flanelinha.tsx`, `fiscal/flanelinhas.tsx`,
`fiscal/perfil.tsx`) ainda são placeholders com "Em construção". Este sub-projeto substitui esse
conteúdo pelas telas reais.

O backend já suporta a maior parte do necessário (`FiscalController`, `FlanelinhaController`,
ambos protegidos por JWT com checagem de propriedade — ver
`2026-08-02-flanelinha-fiscal-backend-design.md`), com uma lacuna: não existe endpoint para o
Fiscal editar os dados de um Flanelinha já cadastrado (o único `PUT .../perfil` existente é
restrito ao próprio Flanelinha). Este sub-projeto inclui a extensão necessária no backend para
cobrir essa lacuna.

## Decisões confirmadas com o usuário

1. **Captura de foto do Flanelinha**: fora de escopo. A spec original mencionava isso, mas o
   backend não tem nenhum campo pra armazenar imagem (nem no model, nem nos DTOs). Fica para um
   sub-projeto futuro que estenda o backend, se necessário.
2. **Senha no cadastro de Flanelinha**: sem campo de senha na tela — o backend já usa o valor
   padrão (`"Senha123"`) quando `Senha` não é enviado no `POST`, e o Flanelinha troca a senha no
   primeiro acesso (fluxo já implementado no sub-projeto 2).
3. **Edição de Flanelinha pelo Fiscal**: incluída, com edição completa (Nome, Email, Ponto de
   Atuação, Telefone, Ativo/Inativo) — exige um novo endpoint no backend (seção 1).
4. **Lista de Flanelinhas**: sem busca/filtro nesta etapa. Cada item mostra Nome, Ponto de Atuação
   (subtítulo) e um indicador visual de Ativo/Inativo.
5. **Abrir detalhe de um Flanelinha**: navega para uma tela dedicada (rota própria), não um Modal.
6. **Excluir Flanelinha**: botão na tela de detalhe, com confirmação via `Modal` (componente já
   existente) antes de chamar `DELETE`.
7. **Home do Fiscal**: saudação com o nome do Fiscal + resumo rápido (total de Flanelinhas
   cadastrados, quantos ativos), calculado no cliente a partir de `GET /api/flanelinha` — sem
   necessidade de endpoint novo para isso.
8. **Atualizar Dados do Fiscal**: uma tela com duas seções independentes — editar Nome/Email, e
   trocar senha (Senha Atual, Nova Senha, Confirmar) — usando os dois endpoints que já existem em
   `FiscalController`.
9. **Navegação pós-sucesso**: tanto o cadastro quanto a edição de um Flanelinha voltam para a lista
   (`fiscal/flanelinhas`) com um `Banner` verde de confirmação, seguindo o mesmo padrão de
   parâmetro de rota já usado no fluxo Alterar Senha → Login do sub-projeto 2.
10. **Verificação**: sem framework de testes automatizados (mesma convenção dos sub-projetos
    anteriores) — verificação manual contra o backend real.
11. **Layout visual**: confirmado via companion visual (mockups das 5 telas) — ver seção 3.

## 1. Extensão do backend

Novo endpoint em `FiscalController` — **não** em `FlanelinhaController/{id}/perfil`, que continua
restrito ao próprio Flanelinha (`Authorize(Roles = "Flanelinha")`) e só cobre Nome/Email. A edição
pelo Fiscal precisa de uma rota própria porque abrange mais campos e tem uma regra de autorização
diferente (dono do cadastro, não o próprio Flanelinha).

`api/Controllers/FlanelinhaController.cs` — novo action:

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

Mesmo padrão de checagem de propriedade já usado em `GetById`/`Delete` nesse controller (`403` via
`Forbid()` se o Flanelinha não pertence ao Fiscal autenticado). `Cpf` não é editável — mesma
convenção do `UpdatePerfilDto` existente, que também não expõe o CPF.

Usa `GetByIdAsync` (não `GetByIdWithCarterinhasAsync`) — mesmo método já usado por `Delete` nesse
controller — então o `carterinhas` no `FlanelinhaDto` de resposta vem vazio independente das
carteirinhas reais do Flanelinha. Não é um bug: nenhuma tela deste sub-projeto usa o `carterinhas`
da resposta desse endpoint (a tela de detalhe, seção 3.4, já tem os dados que precisa a partir do
`GET` inicial).

Novo `api/Dtos/Flanelinha/UpdateFlanelinhaDto.cs`:

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

Rota final: `PUT /api/flanelinha/{id}` (verbo + caminho distintos de `PUT /api/flanelinha/{id}/perfil`,
sem colisão de rota no ASP.NET Core).

## 2. Estrutura de arquivos (mobile)

```
mobile/
  app/
    fiscal/
      home.tsx                        # Conteúdo real (era placeholder)
      cadastrar-flanelinha.tsx        # Conteúdo real (era placeholder)
      flanelinhas.tsx                 # Conteúdo real — lista (era placeholder)
      perfil.tsx                      # Conteúdo real (era placeholder)
      flanelinha/
        [id].tsx                      # Novo — tela de detalhe/edição. Nome no singular
                                       # (distinto de flanelinhas.tsx, a lista, e de
                                       # app/flanelinha/ — as rotas do perfil Flanelinha,
                                       # pasta irmã fora de fiscal/): evita colisão com o
                                       # arquivo flanelinhas.tsx já existente no mesmo nível
                                       # (Expo Router não permite um arquivo e uma pasta de
                                       # mesmo nome na mesma pasta pai).
  src/
    api/
      flanelinha.ts                   # Novo — CRUD de Flanelinha do ponto de vista do Fiscal
      fiscal.ts                       # Novo — atualizar perfil e trocar senha do próprio Fiscal
    types/
      flanelinha.ts                   # Novo — FlanelinhaDto, CarterinhaDto, Create/UpdateFlanelinhaDto
    context/
      AuthContext.tsx                 # Modificado — novo método updateProfile (seção 3.5)
```

`fiscal/flanelinha/[id].tsx` (nome no singular — ver nota na árvore de arquivos acima) é uma rota
dinâmica dentro da mesma pasta `fiscal/`, então continua
dentro do `<Drawer>` já configurado em `fiscal/_layout.tsx` (o Drawer continua acessível a partir
dela) — não precisa aparecer na lista `items` do `DrawerContent` nem ser declarada como
`<Drawer.Screen>` explícita em `_layout.tsx`; é alcançada só por navegação programática
(`router.push`) a partir da lista.

`src/types/flanelinha.ts` (espelha os DTOs do backend, `camelCase`):

```typescript
export interface CarterinhaDto {
  idCarterinha: number;
  numeroCarterinha: number;
  dataEmissao: string;
  dataValidade: string;
  ativo: boolean;
  tipo: number; // TipoCarterinha do backend, serializado como int (sem JsonStringEnumConverter
                // registrado em Program.cs) — 1 = PrimeiraVia, 2 = SegundaVia. Não usado por
                // nenhuma tela deste sub-projeto; tipado corretamente aqui só pra manter o
                // espelhamento do DTO honesto.
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

(`CreateFlanelinhaDto` do cliente não inclui `senha` nem `ativo` — o backend usa os defaults
`"Senha123"` e `true`, conforme decisão 2.)

`src/api/flanelinha.ts`:

```typescript
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

`src/api/fiscal.ts`:

```typescript
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

(Reutiliza o tipo `FiscalPerfil` já definido em `src/types/auth.ts` — mesma forma retornada por
`ToFiscalDto()` no backend.)

**Extensão do `AuthContext`** (`src/context/AuthContext.tsx`): a tela de Atualizar Dados (seção
3.5) precisa refletir o novo Nome/Email na sessão em memória e no `AsyncStorage` depois de um
`PUT .../perfil` bem-sucedido, mas o `AuthContext` atual só expõe `login`/`logout` — nenhum dos
dois serve pra uma atualização parcial de um perfil já autenticado. Novo método `updateProfile`,
seguindo o mesmo padrão de `login` (monta a sessão nova, atualiza o estado, persiste no
`AsyncStorage`):

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

Adicionado a `AuthContextValue` (`updateProfile: (perfil: FiscalPerfil | FlanelinhaPerfil) =>
Promise<void>`) e ao objeto retornado por `useMemo` (junto com `session`, `isLoading`, `login`,
`logout`), incluindo `updateProfile` nas dependências do `useMemo`. Não precisa de checagem de
`tipoPerfil` — quem chama já sabe qual tipo de `perfil` está passando (a tela de Atualizar Dados do
Fiscal, seção 3.5, só existe no fluxo do Fiscal).

## 3. Telas

Layout visual de todas as telas abaixo confirmado via companion visual (mockups com os tokens de
`src/theme/colors.ts` já existentes — nenhuma cor nova).

### 3.1 Home (`fiscal/home.tsx`)

Ao montar, chama `listFlanelinhas()` e mostra:

- Saudação: "Olá, `{perfil.nome}`" (do `AuthContext`) + subtítulo "Bem-vindo de volta".
- Dois cartões de resumo lado a lado: total de itens retornados (**Flanelinhas cadastrados**) e
  quantos têm `ativo === true` (**Ativos**).

Enquanto a chamada está em andamento, mostra um `ActivityIndicator` simples no lugar dos cartões
(sem um novo componente de loading — o design system ainda não tem um, e criar um só para isso é
desproporcional ao escopo). Erro de rede/servidor: `Banner` vermelho com
`extractErrorMessage(error)` no lugar dos cartões, sem opção de retry nesta etapa (reabrir a tela —
trocar de aba no Drawer e voltar — já refaz a chamada).

### 3.2 Cadastrar Flanelinha (`fiscal/cadastrar-flanelinha.tsx`)

Formulário com `Input` para Nome, CPF, Email, Ponto de Atuação, Telefone (nessa ordem, conforme o
mockup aprovado). Mesmo padrão de validação client-side já usado no Login: se algum campo estiver
vazio ao enviar, `Banner` vermelho "Preencha todos os campos", sem chamar a API. CPF usa
`keyboardType="number-pad"`, `maxLength={11}`, e o valor é sanitizado (`replace(/\D/g, "")`) antes
de enviar — mesmo tratamento do campo CPF no Login.

Sucesso (`201`): navega para `fiscal/flanelinhas` passando `{ cadastroSucesso: "1" }` como
parâmetro de rota (mesmo padrão do `senhaAlterada=1` usado no fluxo Login ↔ Alterar Senha do
sub-projeto 2). A tela de lista lê esse parâmetro ao montar e mostra `Banner` verde "Flanelinha
cadastrado com sucesso.".

Falha (`400`, ex. CPF duplicado — há índice único em `Flanelinha.Cpf`): `Banner` vermelho com
`extractErrorMessage(error)`, permanece na tela com os dados preenchidos (não limpa o formulário).

### 3.3 Visualizar Flanelinhas (`fiscal/flanelinhas.tsx`)

Lista (`FlatList`) de cartões, um por Flanelinha retornado por `listFlanelinhas()`: Nome em
destaque, Ponto de Atuação como subtítulo, badge "Ativo"/"Inativo" (verde/vermelho, mesmas cores de
`Banner`). Tocar num cartão navega para `fiscal/flanelinha/{idFlanel}` (seção 3.4).

- Recarrega a lista sempre que a tela ganha foco (`useFocusEffect` do `expo-router`/React
  Navigation) — garante que cadastro, edição e exclusão feitos nas outras telas apareçam
  atualizados ao voltar, sem precisar de um mecanismo de cache/invalidação mais sofisticado.
- Lista vazia: texto centralizado "Nenhum Flanelinha cadastrado ainda." (sem ilustração/componente
  novo).
- Ao montar com `params.cadastroSucesso === "1"`, `params.edicaoSucesso === "1"` ou
  `params.exclusaoSucesso === "1"`, mostra o `Banner` verde correspondente ("Flanelinha cadastrado
  com sucesso." / "Alterações salvas com sucesso." / "Flanelinha excluído com sucesso.") acima da
  lista.
- Erro ao carregar: `Banner` vermelho com `extractErrorMessage(error)` no lugar da lista.

### 3.4 Detalhe/Editar Flanelinha (`fiscal/flanelinha/[id].tsx`)

Ao montar, chama `getFlanelinha(id)` (`id` vem do parâmetro de rota, convertido pra `number`) e
preenche o formulário: Nome, Email, Ponto de Atuação, Telefone (todos `Input`), e um toggle
Ativo/Inativo (`Switch` do React Native — não existe um componente de toggle no design system
ainda; usar o `Switch` nativo estilizado com `colors.primary`/`colors.success` é suficiente pro
escopo, sem justificar um novo componente reutilizável para um único uso nesta etapa). CPF é
mostrado como texto somente-leitura (não é um `Input` editável), já que não é editável pelo Fiscal.

- **Salvar Alterações**: mesma validação client-side de campos vazios do cadastro. Chama
  `updateFlanelinha(id, dto)`. Sucesso (`200`): navega para `fiscal/flanelinhas` com
  `{ edicaoSucesso: "1" }`. Falha (`400`/`403`/`404`): `Banner` vermelho com
  `extractErrorMessage(error)`.
- **Excluir Flanelinha**: botão abaixo do de salvar (visualmente distinto — fundo
  `colors.errorBackground`, texto `colors.error`, conforme o mockup). Abre o `Modal` existente
  (`title="Excluir Flanelinha"`, conteúdo "Tem certeza que deseja excluir `{nome}`? Essa ação não
  pode ser desfeita.", ações "Cancelar"/"Excluir" usando `Button` `secondary`/`primary`). Confirmar
  chama `deleteFlanelinha(id)`; sucesso (`204`) navega para `fiscal/flanelinhas` com
  `{ exclusaoSucesso: "1" }` (banner verde "Flanelinha excluído com sucesso."); falha mostra
  `Banner` vermelho dentro do próprio `Modal` (sem fechar o `Modal`, permitindo tentar de novo ou
  cancelar).

### 3.5 Atualizar Dados (`fiscal/perfil.tsx`)

Duas seções na mesma tela, cada uma com seu próprio estado de erro/sucesso (`Banner` local, não
compartilhado entre as seções):

- **Dados**: `Input` Nome/Email pré-preenchidos com `perfil` do `AuthContext`. Botão "Salvar Dados"
  chama `updateFiscalPerfil(idFiscal, dto)`. Sucesso (`200`): chama `updateProfile(response)` (novo
  método do `AuthContext`, ver seção 2) com o `FiscalPerfil` retornado pelo backend, e mostra
  `Banner` verde "Dados atualizados com sucesso." acima da seção — permanece na mesma tela (não há
  navegação, ao contrário do cadastro/edição de Flanelinha, porque aqui não existe uma "lista" pra
  onde voltar).
- **Trocar Senha**: `Input` Senha Atual, Nova Senha, Confirmar Nova Senha (todos
  `secureTextEntry`). Validação client-side: campos não vazios e Nova Senha === Confirmar, senão
  `Banner` vermelho "As senhas não coincidem" (mesmo texto/padrão do Alterar Senha do sub-projeto
  2), sem chamar a API. Botão "Trocar Senha" chama `changeFiscalPassword(idFiscal, senhaAtual,
  novaSenha)`. Sucesso (`204`): limpa os três campos e mostra `Banner` verde "Senha alterada com
  sucesso." — **não** desloga o Fiscal (ao contrário do primeiro acesso do Flanelinha, que exige
  novo login; aqui `SenhaAtual` já teve que ser validada, então não há o mesmo risco de digitar
  errado sem perceber). Falha (`400`, ex. `"Senha atual inválida."`): `Banner` vermelho com
  `extractErrorMessage(error)`.

## 4. Verificação

Sem framework de testes automatizados (mesma convenção dos sub-projetos anteriores). Verificação
manual contra o backend real (`dotnet run` em `api/`):

- Home do Fiscal mostra o nome correto e os totais corretos (comparar com a contagem real no
  banco).
- Cadastrar Flanelinha com todos os campos vazios → erro client-side, sem chamar a API.
- Cadastrar Flanelinha com CPF já existente → `Banner` vermelho com a mensagem do backend.
- Cadastrar Flanelinha com sucesso → volta pra lista, `Banner` verde, novo item aparece na lista.
- Lista mostra Nome/Ponto de Atuação/status corretamente pra cada Flanelinha cadastrado.
- Tocar num item da lista → abre o detalhe com os dados corretos pré-preenchidos.
- Editar e salvar → volta pra lista, `Banner` verde, dados atualizados aparecem na lista.
- Alternar Ativo/Inativo no detalhe e salvar → badge correspondente muda na lista.
- Excluir um Flanelinha (confirmando no Modal) → volta pra lista, `Banner` verde, item some da
  lista.
- Cancelar a exclusão no Modal → nada acontece, Flanelinha continua na lista.
- Atualizar Dados do Fiscal (Nome/Email) → `Banner` verde, permanece na tela, nome atualizado
  também aparece na Home (reabrir a aba).
- Trocar senha com "Nova Senha" ≠ "Confirmar" → erro client-side, sem chamar a API.
- Trocar senha com Senha Atual errada → `Banner` vermelho com a mensagem do backend.
- Trocar senha com sucesso → `Banner` verde, consegue fazer logout e login de novo com a nova
  senha.
- Confirmar que o novo endpoint `PUT /api/flanelinha/{id}` rejeita (`403`) uma tentativa de editar
  um Flanelinha que pertence a outro Fiscal (testável diretamente via `curl`/Postman com o token de
  um Fiscal diferente).

## Fora de escopo

- Captura de foto do Flanelinha (decisão 1).
- Campo de senha customizado no cadastro de Flanelinha (decisão 2).
- Busca/filtro na lista de Flanelinhas (decisão 4).
- Qualquer conteúdo do fluxo do Flanelinha (carteira digital, solicitar carteirinha) — sub-projeto
  4.
- Testes automatizados (mesma decisão já tomada nos sub-projetos anteriores).
- Um componente de toggle reutilizável no design system — usado `Switch` nativo diretamente nesta
  etapa (seção 3.4), já que é o único lugar que precisa disso até agora.
