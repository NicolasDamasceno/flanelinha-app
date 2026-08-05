# Design: Fluxo de Telas do Flanelinha

## Contexto

Este é o quarto e último sub-projeto da camada de frontend mobile (auth backend → scaffold +
design system + navegação → fluxo Fiscal → **fluxo Flanelinha**). O terceiro sub-projeto
(`2026-08-03-fiscal-flow-screens-design.md`, já mergeado em `main`) entregou as telas do Fiscal.
As três rotas do Flanelinha (`flanelinha/home.tsx`, `flanelinha/solicitar-carteirinha.tsx`) ainda
são placeholders com "Em construção", e não existe tela de "Atualizar Dados" para esse perfil
(diferente do Fiscal, que já tem a sua). Este sub-projeto substitui os placeholders pelas telas
reais e adiciona a terceira tela.

O backend já suporta quase tudo (`FlanelinhaController`: `PUT {id}/perfil`, `PUT {id}/senha`,
`POST {id}/carteiras`), com uma lacuna: não existe endpoint para o próprio Flanelinha buscar seus
dados (incluindo carteirinhas) de forma independente da sessão de login. Este sub-projeto inclui a
extensão necessária no backend para cobrir essa lacuna.

## Decisões confirmadas com o usuário

1. **QR code na carteira**: gerado no cliente, contendo apenas o número da carteirinha (sem
   alteração no backend) — mesmo precedente da foto do Flanelinha (fora de escopo) no sub-projeto
   3: nenhuma persistência nova, resolve com o que já existe.
2. **Frescor dos dados da carteira**: a resposta de login nunca preenche `carterinhas` (campo
   sempre `[]` — lacuna documentada em `src/types/auth.ts`, comentário "sempre \[\] na resposta de
   login"). Em vez de tentar corrigir a query de login, um endpoint novo e dedicado
   (`GET /api/flanelinha/me`), buscado a cada vez que a tela ganha foco — mesmo padrão "nunca
   confiar em dado de sessão parado" já usado em `flanelinhas.tsx` do sub-projeto 3.
3. **Tela "Atualizar Dados" do Flanelinha**: incluída (não estava nos placeholders originais),
   espelhando a mesma tela do Fiscal (`fiscal/perfil.tsx`) — Nome/Email editáveis e troca de senha,
   usando os endpoints `PUT {id}/perfil` e `PUT {id}/senha` que já existem.
4. **Home sem carteirinha ainda**: estado vazio com texto explicativo + botão de ação que leva
   direto para Solicitar Carteirinha.
5. **Home com carteirinha vencida**: cartão mostrado com estilo de alerta (borda/badge vermelhos,
   QR code esmaecido) + badge "Vencida", com botão "Solicitar Renovação".
6. **Solicitar Carteirinha quando a atual ainda é válida**: bloqueado no cliente — a tela busca o
   status atual ao abrir e, se ainda válido, mostra a carteira atual + aviso com a data de validade
   e desabilita o botão de solicitação, em vez de deixar tentar e mostrar o erro `400` do backend
   ("A carteira atual ainda é válida.").
7. **Biblioteca de QR code**: só JS, sem dependência nativa — evita precisar reconstruir o dev
   client custom no celular antes do próximo teste manual.
8. **Layout visual**: confirmado via companion visual (mockups das 3 telas, incluindo os estados de
   Home) — ver seção 3.

## 1. Extensão do backend

Novo endpoint em `FlanelinhaController` — **não** reaproveitando `GetById` (que é
`[Authorize(Roles = "Fiscal")]`, do ponto de vista do Fiscal dono do cadastro). Rota própria porque
a regra de autorização é diferente (o próprio Flanelinha, identificado pelo token, não um `id` de
rota arbitrário).

`api/Controllers/FlanelinhaController.cs` — novo action, ao lado de `UpdatePerfil`/`ChangePassword`/
`RequestCarteira` (que já seguem esse mesmo padrão de resolver o alvo via `AuthenticatedId`):

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

Reaproveita `GetByIdWithCarterinhasAsync`, o mesmo método já usado por `RequestCarteira` (para
calcular a carteira ativa) e pelo `GetById` do lado do Fiscal — nenhum repositório novo. Rota final:
`GET /api/flanelinha/me`, sem colisão com `GET /api/flanelinha/{id}` (ASP.NET Core roteia `"me"`
como valor literal, não como candidato a `{id}`, mas para evitar qualquer ambiguidade o action é
declarado depois de `GetById` no arquivo — mesma ordem defensiva não é estritamente necessária, mas
mantém o arquivo fácil de ler).

## 2. Estrutura de arquivos (mobile)

```
mobile/
  app/
    flanelinha/
      home.tsx                        # Conteúdo real (era placeholder)
      solicitar-carteirinha.tsx       # Conteúdo real (era placeholder)
      atualizar-dados.tsx             # Novo — Nome/Email + trocar senha
      _layout.tsx                     # Modificado — novo item de menu "Atualizar Dados"
  src/
    api/
      flanelinha.ts                   # Modificado — getMyFlanelinha, requestCarteira
    types/
      flanelinha.ts                   # Sem alterações (CarterinhaDto já cobre tudo)
    utils/
      qrcode.ts                       # Novo — encoding puro JS (matriz de módulos)
    components/
      QrCode.tsx                      # Novo — renderiza a matriz como grade de Views
```

`src/api/flanelinha.ts` — duas funções novas, ao lado das já existentes (`listFlanelinhas`,
`getFlanelinha`, `createFlanelinha`, `updateFlanelinha`, `deleteFlanelinha`, usadas pelo lado
Fiscal):

```typescript
export async function getMyFlanelinha(): Promise<FlanelinhaDto> {
  const response = await apiClient.get<FlanelinhaDto>("/api/flanelinha/me");
  return response.data;
}

export async function requestCarteira(id: number): Promise<CarterinhaDto> {
  const response = await apiClient.post<CarterinhaDto>(`/api/flanelinha/${id}/carteiras`, {});
  return response.data;
}
```

(`requestCarteira` envia `{}` como corpo — o backend aceita `RequestCarteiraDto?` e o tipo não tem
nenhum campo, então um objeto vazio é suficiente; `id` vem de `(session.perfil as
FlanelinhaPerfil).idFlanel`, mesmo padrão de cast já usado em `(auth)/alterar-senha.tsx` e
`fiscal/perfil.tsx` para o campo equivalente do outro perfil.)

`src/utils/qrcode.ts` — usa `qrcode-generator` (pacote npm puro JS, sem dependência nativa; precisa
ser adicionado a `package.json`):

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

`src/components/QrCode.tsx` — renderiza a matriz como uma grade de `View`s, sem SVG:

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
    <View style={{ width: size, height: size, backgroundColor: "#FFFFFF" }}>
      {matrix.map((row, rowIndex) => (
        <View key={rowIndex} style={{ flexDirection: "row" }}>
          {row.map((isDark, colIndex) => (
            <View
              key={colIndex}
              style={{
                width: moduleSize,
                height: moduleSize,
                backgroundColor: isDark ? colors.text : "#FFFFFF",
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
```

Valor codificado: `String(carteira.numeroCarterinha)` (decisão 1) — nenhum outro campo, então o
`value` passado é só o número, convertido para string.

`_layout.tsx` (modificado) — novo item de menu, terceira rota registrada no `<Drawer>`:

```typescript
const items: DrawerMenuItem[] = [
  { label: "Início", route: "/flanelinha/home" },
  { label: "Solicitar Carteirinha Nova", route: "/flanelinha/solicitar-carteirinha" },
  { label: "Atualizar Dados", route: "/flanelinha/atualizar-dados" },
];
```

```typescript
<Drawer.Screen name="atualizar-dados" options={{ title: "Atualizar Dados" }} />
```

(mesmo padrão do `fiscal/_layout.tsx`, três `<Drawer.Screen>` explícitas com `title`.)

`src/types/flanelinha.ts` **não muda** — `FlanelinhaDto` e `CarterinhaDto` já têm todos os campos
que as telas deste sub-projeto precisam (herdados do sub-projeto 3).

## 3. Telas

Layout visual de todas as telas abaixo confirmado via companion visual (mockups com os tokens de
`src/theme/colors.ts` já existentes — nenhuma cor nova).

### 3.1 Home / Carteira Digital (`flanelinha/home.tsx`)

Chama `getMyFlanelinha()` sempre que a tela ganha foco (`useFocusEffect` + guarda `cancelled`,
mesmo mecanismo de `fiscal/flanelinhas.tsx`). Entre os itens de `carterinhas` retornados, seleciona
o de maior `dataEmissao` como "carteira atual" (mesma lógica do backend em `RequestCarteira` —
`OrderByDescending(c => c.DataEmissao).FirstOrDefault()` — replicada no cliente porque o endpoint
`/me` retorna a lista completa, não um campo "carteira atual" separado).

Três estados de renderização, decididos a partir da carteira atual:

- **Nenhuma carteira** (`carterinhas` vazio): estado vazio — ícone + "Você ainda não tem uma
  carteirinha" + texto explicativo + botão "Solicitar Carteirinha" que navega para
  `flanelinha/solicitar-carteirinha`.
- **Carteira válida** (`dataValidade` no futuro): cartão com Número, Ponto de Atuação (do
  `FlanelinhaDto`, não da carteira), Validade (formatada `DD/MM/AAAA`), badge verde "Ativa",
  `QrCode` codificando `numeroCarterinha`.
- **Carteira vencida** (`dataValidade` no passado): mesmo cartão com borda/fundo vermelhos, badge
  vermelho "Vencida", QR code com opacidade reduzida (`opacity: 0.3`, só decorativo — não faz
  sentido escanear uma carteira vencida), botão "Solicitar Renovação" abaixo do cartão navegando
  para `flanelinha/solicitar-carteirinha`.

Enquanto a chamada está em andamento: `ActivityIndicator` (mesmo padrão de `fiscal/home.tsx`, sem
componente de loading novo). Erro de rede/servidor: `Banner` vermelho com
`extractErrorMessage(error)` no lugar do cartão/estado vazio — trocar de aba e voltar aciona o
`useFocusEffect` de novo, funcionando como retry.

### 3.2 Solicitar Carteirinha Nova (`flanelinha/solicitar-carteirinha.tsx`)

Também busca `getMyFlanelinha()` ao ganhar foco (mesma lógica de seleção da "carteira atual" da
seção 3.1 — duplicada entre as duas telas por serem buscas independentes; extrair um hook
compartilhado tipo `useCarteiraAtual()` é deixado como melhoria futura, não crítico pro escopo
atual).

- **Sem carteira, ou carteira vencida**: mostra um botão "Solicitar Nova Via" habilitado. Ao
  pressionar, chama `requestCarteira(idFlanel)`. Sucesso (`201`): `Banner` verde "Carteirinha
  emitida com sucesso." e `router.replace("/flanelinha/home")` (mesmo padrão de navegar para longe
  da tela de ação após sucesso, usado em `fiscal/cadastrar-flanelinha.tsx`). Falha (`400`/outro):
  `Banner` vermelho com `extractErrorMessage(error)`, permanece na tela.
- **Carteira ainda válida** (decisão 6): mostra a carteira atual (versão compacta, só Número e
  Validade) + uma caixa de aviso amarela ("Sua carteira atual ainda é válida até `{dataValidade}`.
  Não é possível solicitar uma nova até o vencimento.") + botão "Solicitar Nova Via" **desabilitado**
  (`disabled`, estilo acinzentado). O bloqueio é só no cliente — o `400` do backend continua sendo o
  guarda-corpo real (ex. se os dados ficarem des-sincronizados por uma janela de corrida entre o
  fetch e uma ação em outra aba), então o `handleSolicitar` também trata esse erro normalmente via
  `Banner`, mesmo com o botão nominalmente desabilitado.

Estado de carregamento/erro do fetch inicial: mesmo padrão da seção 3.1.

### 3.3 Atualizar Dados (`flanelinha/atualizar-dados.tsx`)

Estrutura idêntica a `fiscal/perfil.tsx` (duas seções independentes, cada uma com seu próprio par
de `Banner` local com auto-esconder em 3s), com duas diferenças:

- Só Nome e Email na seção de dados (sem Ponto de Atuação/Telefone — não editáveis pelo próprio
  Flanelinha, mesma restrição já expressa no backend por `UpdatePerfilDto` só ter esses dois
  campos). Chama `updatePerfilFlanelinha(idFlanel, dto)` via `PUT /api/flanelinha/{id}/perfil` (nova
  função em `src/api/flanelinha.ts`, mesmo formato de `updateFiscalPerfil`).
- Seção de trocar senha idêntica à do Fiscal (`Senha Atual`, `Nova Senha`, `Confirmar Nova Senha`,
  mesmas validações e mensagens), mas chamando `PUT /api/flanelinha/{id}/senha` (nova função
  `changeFlanelinhaPassword`, mesmo formato de `changeFiscalPassword`).

`idFlanel` vem de `(session.perfil as FlanelinhaPerfil).idFlanel` — mesmo padrão de cast usado em
`(auth)/alterar-senha.tsx`, seguro aqui porque esta tela só é alcançável dentro do fluxo do
Flanelinha. Sucesso na seção de dados chama `updateProfile(response)` do `AuthContext` (método já
existente, usado pelo lado Fiscal — aceita `FiscalPerfil | FlanelinhaPerfil`, então não precisa de
nenhuma mudança).

`src/api/flanelinha.ts` — duas funções adicionais para esta tela (junto às da seção 2):

```typescript
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

(`PUT {id}/senha` no backend não exige `senhaAtual` quando `PrimeiroAcesso == true` — mas essa tela
só é alcançável depois do login normal, quando `PrimeiroAcesso` já é `false` (o fluxo de primeiro
acesso força a troca antes de entrar no Drawer, sub-projeto 2), então sempre envia `senhaAtual`
preenchido, mesma UX do lado Fiscal.)

## 4. Verificação

Sem framework de testes automatizados (mesma convenção dos sub-projetos anteriores). Verificação
manual contra o backend real (`dotnet run` em `api/`):

- Login com um Flanelinha sem nenhuma carteirinha → Home mostra o estado vazio.
- Solicitar Carteirinha (sem carteira ainda) → sucesso, volta pra Home, cartão aparece com os dados
  corretos e QR code visível.
- Solicitar Carteirinha de novo, agora com a carteira ainda válida → tela mostra o aviso e o botão
  desabilitado, sem conseguir chamar a API pelo botão.
- Confirmar que o QR code renderizado corresponde ao número da carteirinha (ex. usando um leitor de
  QR code qualquer no próprio celular, apontando pra tela).
- Simular uma carteira vencida (ajustar `DataValidade` direto no banco pra uma data passada) → Home
  mostra o estado "Vencida" (cores/badge corretos, QR esmaecido) e "Solicitar Renovação" funciona,
  emitindo uma nova carteira e voltando ao estado "Ativa".
- Atualizar Dados (Nome/Email) → `Banner` verde, nome atualizado também aparece se voltar pra Home
  (reabrir a aba).
- Trocar senha com sucesso → `Banner` verde, consegue fazer logout e login de novo com a nova senha.
- Trocar senha com Senha Atual errada → `Banner` vermelho com a mensagem do backend.
- Confirmar que `GET /api/flanelinha/me` retorna `401` sem token e nunca retorna dados de outro
  Flanelinha (não há `id` na rota — só pode retornar o dono do token).

## Fora de escopo

- Qualquer alteração na resposta de login (`AuthController`) — decisão 2, resolvido com endpoint
  novo em vez de mudar a query existente.
- Campo de foto na carteirinha — mesma decisão já tomada no sub-projeto 3 (nenhum campo no backend
  pra isso).
- QR code com dependência nativa (`react-native-svg`) — decisão 7.
- Hook compartilhado `useCarteiraAtual()` entre Home e Solicitar Carteirinha (nota na seção 3.2) —
  duplicação pequena e aceitável nesta etapa.
- Testes automatizados (mesma decisão já tomada nos sub-projetos anteriores).
