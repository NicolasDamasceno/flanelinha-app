# Design: Scaffold Mobile (Expo) + Design System + Navegação

## Contexto

Este é o segundo de quatro sub-projetos da camada de frontend mobile (auth backend →
**scaffold + design system + navegação** → fluxo Fiscal → fluxo Flanelinha). O primeiro
(`2026-08-02-flanelinha-auth-backend-design.md`) já entregou `POST /api/auth/login` e protegeu
todos os endpoints existentes com JWT — este sub-projeto constrói a base do app React Native que
consome esse backend: o projeto Expo em si, o sistema de componentes reutilizáveis, e a navegação
completa (incluindo os dois Drawers por perfil), com o fluxo de autenticação/primeiro acesso
totalmente funcional. As telas específicas de cada perfil (cadastro de flanelinha, carteira
digital, etc.) ficam como placeholders — conteúdo real vem nos sub-projetos 3 e 4.

Hoje não existe nenhum código mobile no repositório (só uma pasta `.expo/` vazia). É um projeto
genuinamente greenfield.

## Decisões confirmadas com o usuário

1. **Localização**: novo projeto Expo em `mobile/`, na raiz do repo, ao lado de `api/`.
2. **Linguagem**: TypeScript.
3. **Gerenciador de pacotes**: npm.
4. **Navegação**: Expo Router (roteamento baseado em arquivos, usa React Navigation por baixo).
5. **Estado de sessão**: React Context (`AuthContext`) + `AsyncStorage` para persistência entre
   aberturas do app — sem biblioteca de state management externa.
6. **Cliente HTTP**: axios (conforme já definido no `README.md` do projeto).
7. **URL da API**: variável de ambiente Expo (`EXPO_PUBLIC_API_URL`) via `.env` (não versionado) +
   `.env.example` (versionado, com um valor de exemplo).
8. **Paleta**: Azul Royal `#1D4ED8` como cor principal/de ação, branco como base, vermelho para
   erro/validação, verde para sucesso/confirmação — confirmados via companion visual.
9. **Verificação**: sem framework de testes automatizados neste sub-projeto (mesma convenção
   adotada no backend) — verificação manual via Expo Go/emulador contra o backend real.
10. **Telas específicas de perfil (sub-projetos 3/4) entram como placeholders**: os arquivos de
    rota já existem e aparecem no Drawer correspondente, com um conteúdo mínimo "Em construção" —
    isso deixa a navegação 100% completa desde este sub-projeto, e os sub-projetos seguintes só
    substituem o conteúdo de cada arquivo, sem tocar em roteamento/Drawer de novo.

## 1. Scaffold do projeto

Criado com `npx create-expo-app@latest mobile --template blank-typescript` (ou equivalente),
depois adicionando `expo-router` e convertendo para a estrutura baseada em `app/` (o comando atual
do Expo já pode gerar isso diretamente dependendo da versão do CLI — usar o template oficial mais
recente com Expo Router e TypeScript pré-configurados, evitando montar a config manualmente).

Pacotes adicionais, além do que o template já traz:

- `expo-router` (se não vier pelo template)
- `axios`
- `@react-native-async-storage/async-storage`
- `@react-navigation/drawer` — **necessário explicitamente**: `expo-router/drawer` (usado nos
  layouts da seção 2) depende deste pacote, e ele **não** vem incluído no template
  `blank-typescript` base — precisa ser instalado à parte.
- `react-native-safe-area-context`, `react-native-screens`, `react-native-gesture-handler`,
  `react-native-reanimated` (dependências do Expo Router/React Navigation/Drawer — normalmente já
  vêm com o template ou são trazidas como peer dependencies do `@react-navigation/drawer`; conferir
  com `npx expo install @react-navigation/drawer` para que o Expo resolva as versões compatíveis
  automaticamente, em vez de `npm install` direto)

`mobile/.env.example`:

```
EXPO_PUBLIC_API_URL=http://localhost:5080
```

(Porta de exemplo — o valor real depende de como o dev está rodando a API localmente: `10.0.2.2`
no emulador Android, IP da máquina num celular físico, etc. Isso fica documentado no
`mobile/README.md`, não é uma decisão de código.) A API é acessada via HTTP simples em
desenvolvimento (não HTTPS) — o `Program.cs` do backend já comenta `UseHttpsRedirection`, e o
smoke test do sub-projeto 1 já validou a API rodando em HTTP local; usar HTTPS aqui só adicionaria
o problema de certificado de dev não confiável no dispositivo/emulador, sem necessidade.

## 2. Estrutura de pastas

```
mobile/
  app/
    _layout.tsx                     # Root layout: <AuthProvider> envolvendo toda a árvore
    index.tsx                       # Decide rota inicial (ver seção 3)
    (auth)/
      login.tsx
      alterar-senha.tsx             # Fluxo de primeiro acesso do Flanelinha
    (fiscal)/
      _layout.tsx                   # Drawer navigator do Fiscal (expo-router/drawer)
      home.tsx                      # Placeholder — conteúdo real no sub-projeto 3
      cadastrar-flanelinha.tsx      # Placeholder
      flanelinhas.tsx               # Placeholder (lista/consulta)
      perfil.tsx                    # Placeholder (atualização de dados do Fiscal)
    (flanelinha)/
      _layout.tsx                   # Drawer navigator do Flanelinha
      home.tsx                      # Placeholder — conteúdo real no sub-projeto 4 (carteira digital)
      solicitar-carteirinha.tsx     # Placeholder
  src/
    api/
      client.ts                     # Instância axios + interceptors (ver seção 5)
      auth.ts                       # login(cpf, senha), changePassword(id, novaSenha)
    context/
      AuthContext.tsx                # Provider + hook useAuth()
    components/
      Button.tsx
      Input.tsx
      Modal.tsx
      Banner.tsx
      DrawerContent.tsx
    theme/
      colors.ts                      # Paleta centralizada
    types/
      auth.ts                        # Tipos espelhando os DTOs do backend
  .env.example
  app.json
  package.json
  tsconfig.json
```

`src/types/auth.ts` espelha exatamente o formato JSON retornado por `POST /api/auth/login`
(`LoginResponseDto` no backend — serialização padrão do ASP.NET Core usa `camelCase`):

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

## 3. Fluxo de autenticação e navegação

`AuthContext` expõe: `session` (`{ token, tipoPerfil, perfil } | null`), `isLoading` (ainda lendo o
`AsyncStorage`), `login(cpf, senha)`, `logout()`.

**Inicialização** (`app/_layout.tsx` + `app/index.tsx`):

1. `AuthProvider` monta e lê a sessão salva no `AsyncStorage` (chave única, ex.
   `@flanelinha:session`, contendo `{ token, tipoPerfil, perfil }` serializado). Enquanto isso,
   `isLoading = true` — `app/index.tsx` mostra um estado de carregamento neutro (sem flash de tela
   errada).
2. Com a leitura concluída:
   - Sem sessão salva → redireciona para `(auth)/login`.
   - Sessão salva com `tipoPerfil === "Fiscal"` → redireciona para `(fiscal)/home`.
   - Sessão salva com `tipoPerfil === "Flanelinha"` → redireciona para `(flanelinha)/home`.
   - Não há verificação de expiração do JWT nesta etapa — se o token estiver expirado, a primeira
     chamada autenticada feita pela tela de destino vai receber `401` e cair no interceptor global
     (seção 5), que desloga e redireciona para o login. Decodificar o JWT no cliente só para checar
     `exp` antecipadamente é uma otimização de UX, não uma necessidade — fica fora de escopo.

**Login** (`(auth)/login.tsx`, chama `POST /api/auth/login` com corpo `{ cpf: string, senha: string }`,
espelhando `LoginDto` no backend):

- Campos: CPF, Senha (usando o componente `Input`, seção 4). Client-side, se algum campo estiver
  vazio ao tentar enviar, mostra `Banner` vermelho "Preencha todos os campos" (mesma mensagem que
  a spec original pede para os formulários do Fiscal) — sem chamar a API.
- Sucesso (`200`): salva `{ token, tipoPerfil, perfil }` no `AuthContext` e no `AsyncStorage`.
  - `tipoPerfil === "Flanelinha" && primeiroAcesso === true` → navega para `(auth)/alterar-senha`
    (a Home do Flanelinha não é alcançável antes de trocar a senha).
  - Caso contrário → navega para `(fiscal)/home` ou `(flanelinha)/home` conforme `tipoPerfil`.
- Falha (`401`): `Banner` vermelho "CPF ou senha inválidos" (mesmo texto que o backend retorna).
  Tratado localmente pela própria tela — este `401` nunca aciona o interceptor global de logout
  (seção 5), porque a chamada de login não carrega nenhuma sessão pra invalidar.

**Alterar Senha — primeiro acesso** (`(auth)/alterar-senha.tsx`, chama
`PUT /api/flanelinha/{id}/senha`):

- Só é alcançável a partir do fluxo de login com `primeiroAcesso === true` (não faz parte do Drawer
  de nenhum perfil, não tem link de volta para a Home).
- Campos: Nova Senha, Confirmar Nova Senha. Validação client-side: campos não vazios, e os dois
  valores devem ser iguais — senão `Banner` vermelho "As senhas não coincidem" (sem chamar a API).
- `id` vem de `perfil.idFlanel` (já disponível no `AuthContext` a partir do login). Corpo da
  requisição: `{ novaSenha }` (sem `senhaAtual`, pois `PrimeiroAcesso` do Flanelinha ainda é
  `true` no backend nesse momento).
- Sucesso (`204`): conforme a spec original — "Ao salvar a nova senha com sucesso, o app exige um
  novo login" — limpa a sessão (`AuthContext` + `AsyncStorage`) e navega para `(auth)/login`
  passando um parâmetro de rota (ex. `router.replace("/login?senhaAlterada=1")`) — a navegação
  desmonta a tela de Alterar Senha, então esse dado não pode sobreviver como estado de componente
  local; precisa ser o parâmetro de rota mesmo. A tela de login lê esse parâmetro ao montar e
  mostra `Banner` verde "Senha alterada com sucesso. Faça login novamente."
- Falha (`400`): `Banner` vermelho com a mensagem extraída conforme a seção 5 (formato de erro do
  backend).

**Sair** (item fixo em `DrawerContent`, presente nos dois Drawers): limpa `AuthContext` +
`AsyncStorage`, navega para `(auth)/login`.

## 4. Componentes do design system (`src/components/`)

- **`Button`**: `variant: "primary" | "secondary"`, `loading?: boolean`, `disabled?: boolean`,
  `label: string`, `onPress: () => void`. `primary` = fundo azul royal, texto branco. `secondary` =
  fundo branco, borda e texto azul royal.
- **`Input`**: `label: string`, `value`, `onChangeText`, `secureTextEntry?: boolean`,
  `error?: string` (quando presente, borda vermelha + texto de ajuda vermelho abaixo do campo).
- **`Modal`**: shell genérico — `visible: boolean`, `title: string`, `onClose: () => void`,
  `children` (conteúdo), e um slot de ações (ex. par de `Button` confirmar/cancelar). Não tem
  conteúdo de negócio nesta etapa — é a base reutilizável para os modais específicos dos
  sub-projetos 3 (detalhe do flanelinha) e 4 (confirmação de senha na emissão de carteira).
- **`Banner`**: `type: "error" | "success"`, `message: string`. `error` = fundo/texto vermelho,
  `success` = fundo/texto verde, conforme paleta.
- **`DrawerContent`**: recebe `items: { label: string; route: string; icon?: string }[]` (lista
  muda entre `(fiscal)/_layout.tsx` e `(flanelinha)/_layout.tsx`) e sempre renderiza "Sair" fixo no
  final, **além dos itens recebidos** — "Sair" nunca faz parte do array `items` passado pelo layout,
  é sempre um item extra renderizado pelo próprio `DrawerContent`. Contagem exata de itens por
  perfil (usada na seção 6):
  - Fiscal: `items` tem 4 entradas (Home, Cadastrar Flanelinha, Visualizar Flanelinhas, Atualizar
    Dados) + "Sair" = **5 itens no Drawer**.
  - Flanelinha: `items` tem 2 entradas (Home, Solicitar Carteirinha Nova) + "Sair" = **3 itens no
    Drawer**.

`src/theme/colors.ts` centraliza a paleta (usado por todos os componentes acima, não hardcoded
em cada um):

```typescript
export const colors = {
  primary: "#1D4ED8",
  background: "#FFFFFF",
  error: "#DC2626",
  errorBackground: "#FEE2E2",
  success: "#16A34A",
  successBackground: "#DCFCE7",
  textMuted: "#94A3B8",
  border: "#CBD5E1",
};
```

## 5. Cliente de API e tratamento de erro

`src/api/client.ts`: instância axios única, `baseURL: process.env.EXPO_PUBLIC_API_URL`.

- **Interceptor de request**: lê o token atual do `AuthContext` (via uma referência acessível fora
  de componentes React — ex. um pequeno módulo de estado compartilhado atualizado pelo
  `AuthProvider`, já que interceptors do axios não são componentes React e não podem chamar hooks
  diretamente) e anexa `Authorization: Bearer <token>` em toda requisição, **exceto**
  `POST /api/auth/login` (que não tem token ainda).
- **Interceptor de response**: em erro `401` de qualquer chamada que **não seja**
  `POST /api/auth/login`, trata como sessão expirada/inválida — limpa `AuthContext` +
  `AsyncStorage` e redireciona para `(auth)/login`. Isso evita repetir esse tratamento em cada tela
  que faz chamada autenticada.
- Erros de rede (sem resposta do servidor) ou `5xx`: `Banner` vermelho genérico "Não foi possível
  conectar. Tente novamente." — tratado onde a chamada foi feita (não precisa de interceptor
  global, já que a mensagem é sempre a mesma independente da tela).

`src/api/auth.ts` expõe funções tipadas que os componentes chamam (`login(cpf, senha)`,
`changePassword(idFlanel, novaSenha)`), isolando a forma exata da chamada axios das telas.

**Extração de mensagem de erro (`400`)**: o corpo de um `400` não tem um formato único no backend —
depende de qual mecanismo de validação disparou:

- Validação manual do controller (ex. `BadRequest("Senha atual inválida.")` em
  `FlanelinhaController`, ou `Unauthorized(InvalidCredentialsMessage)` em `AuthController`) → corpo
  é uma **string simples**.
- Validação automática do `[ApiController]` via `DataAnnotations` (ex. `NovaSenha` abaixo do
  `[MinLength(6)]` em `ChangePasswordDto`) → corpo é um `ValidationProblemDetails`, um objeto JSON
  com um campo `errors` (dicionário `{ [campo]: string[] }`).

`src/api/client.ts` exporta uma função `extractErrorMessage(error: unknown): string` usada por
todo lugar que precisa mostrar o erro num `Banner`: se `error.response.data` for uma string,
retorna ela direto; se for um objeto com `errors`, pega a primeira mensagem do primeiro campo do
dicionário; caso contrário (erro de rede, sem `response`), retorna a mensagem genérica de conexão
descrita acima.

## 6. Verificação

Sem framework de testes automatizados (mesma convenção do sub-projeto 1). Verificação manual,
rodando `npx expo start` (Expo Go ou emulador) contra o backend real do sub-projeto 1
(`dotnet run` em `api/`):

- App abre sem sessão salva → cai na tela de Login.
- Login com CPF/senha de Fiscal válidos → vai direto para a Home do Fiscal (placeholder), Drawer
  do Fiscal mostra os 5 itens (4 telas + Sair).
- Login com CPF/senha inválidos → `Banner` vermelho inline, permanece na tela de Login.
- Login com CPF/senha de Flanelinha em primeiro acesso → vai para Alterar Senha, não para a Home.
- Alterar Senha com as duas senhas diferentes → erro client-side, sem chamar a API.
- Alterar Senha com sucesso → volta para o Login com `Banner` verde "Senha alterada com sucesso.
  Faça login novamente."
- Login novamente com a nova senha (agora sem primeiro acesso) → vai direto para a Home do
  Flanelinha (placeholder), Drawer do Flanelinha mostra os 3 itens (2 telas + Sair).
- Fechar e reabrir o app (sem logout) → sessão persiste via `AsyncStorage`, pula direto pra Home
  correta sem pedir login de novo.
- "Sair" em qualquer Drawer → volta para Login, e fechar/reabrir o app depois disso não restaura
  mais a sessão.
- `Modal`: como não tem consumidor de negócio neste sub-projeto, verificar renderização (abrir,
  mostrar título/conteúdo/ações, fechar) a partir de um botão de teste temporário em uma das telas
  placeholder — remover esse botão de teste antes de considerar a tarefa concluída, ou deixá-lo
  documentado como ponto de entrada temporário para os sub-projetos 3/4 substituírem.

## Fora de escopo

- Conteúdo real das telas placeholder (`cadastrar-flanelinha`, `flanelinhas`, `perfil`,
  `solicitar-carteirinha`, carteira digital) — sub-projetos 3 e 4.
- Integração de câmera (captura de foto do Flanelinha) e QR code da carteira — sub-projetos 3 e 4,
  respectivamente, quando as telas que os usam forem construídas.
- Decodificação client-side do JWT para checar expiração antecipadamente (ver seção 3).
- Ícone/splash screen customizados do app, configuração de build EAS — assets padrão do template
  Expo por enquanto, sem necessidade de personalização nesta etapa.
- Suporte a Expo Web — o app é mobile-only; CORS não é uma preocupação (não é um browser).
- Testes automatizados (mesma decisão já tomada no sub-projeto 1).
