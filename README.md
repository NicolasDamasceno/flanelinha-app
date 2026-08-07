# Flanelinha App

Aplicativo mobile para cadastramento de flanelinhas e emissão de carteira digital de identificação, desenvolvido como projeto de estudo de React Native/Expo e ASP.NET Core.

## Contexto

Na minha cidade, Teresina - PI, uma lei regulamentou a atividade dos flanelinhas, mas nunca foi implementado um processo de emissão de carteira de cadastramento. Este projeto propõe uma solução para que Fiscais possam cadastrar flanelinhas e emitir carteiras digitais de identificação através de uma aplicação mobile, e para que o próprio flanelinha acompanhe seus dados e exporte sua carteira em PDF.

## Funcionalidades concluídas

**Fiscal**
- Login com CPF e senha (JWT).
- Cadastro de Flanelinha, com foto (câmera ou galeria).
- Listagem, edição e exclusão de Flanelinhas.
- Edição de dados do Flanelinha, incluindo troca da foto.

**Flanelinha**
- Primeiro acesso com senha provisória e troca de senha obrigatória.
- Home com a carteira digital: foto, nome, número, ponto de atuação, validade e QR code.
- Solicitação de primeira via / renovação de carteira.
- Autoatendimento: atualização de nome/e-mail e troca de senha.
- Exportação da carteira digital em PDF (foto, CPF e QR code) e compartilhamento via o menu nativo do Android.

**Geral**
- Identidade visual da Prefeitura de Teresina (telas de login e home).
- Layout responsivo ao teclado em todas as telas de formulário.
- Botão de mostrar/ocultar senha em todos os campos de senha.

## Limitações e funcionalidades pendentes

- Testado apenas em Android físico; build/verificação em iOS não foi feita.
- Sem suíte de testes automatizados (unitários ou de integração).
- Sem paginação na listagem de Flanelinhas do Fiscal.
- A logo da Prefeitura não é exibida na carteira exportada em PDF (foi removida após um bug de resolução de módulo do Metro; pode ser reintroduzida futuramente).

## Tech Stack

**Mobile** (`mobile/`)
- React Native 0.86 + Expo SDK ~57 (Expo Router para navegação, dev client customizado)
- TypeScript (modo estrito)
- Axios (consumo da API)
- AsyncStorage (persistência de sessão)
- `qrcode-generator` (geração do QR code da carteira, em JS puro, sem dependência nativa)
- `expo-image-picker` + `expo-image-manipulator` (captura e compressão de foto)
- `expo-print` + `expo-sharing` (exportação da carteira em PDF e compartilhamento)
- React Navigation (Drawer), React Native Reanimated, Gesture Handler, Safe Area Context, Screens

**Backend** (`api/`)
- ASP.NET Core Web API (.NET 9)
- Entity Framework Core + Npgsql (PostgreSQL)
- JWT Bearer (autenticação de Fiscal e Flanelinha)
- BCrypt.Net-Next (hash de senha)
- Scalar (documentação/exploração da API em `/scalar`)

## Modelo de dados

O sistema trabalha com três entidades principais:

- **Fiscal**: responsável por realizar o cadastramento dos flanelinhas.
- **Flanelinha**: pessoa cadastrada pelo fiscal, vinculada a um ponto de atuação e, opcionalmente, a uma foto.
- **Carteira**: documento digital emitido para o flanelinha, com histórico de emissões (permite renovação e segunda via).

**Relacionamentos:**
1. Um Fiscal cadastra vários Flanelinhas.
2. Um Flanelinha pode possuir várias Carteiras ao longo do tempo.

### Modelo Entidade Relacionamento
<img width="1754" height="1240" alt="Flanelinha_app_der_page-0001" src="https://github.com/user-attachments/assets/32bb7979-547c-46ad-8ad7-9c85aaa5d014" />

## Estrutura do repositório

```
api/            Backend ASP.NET Core (Controllers, Models, Dtos, Repositories, Migrations...)
mobile/         App Expo/React Native (app/ = telas via Expo Router, src/ = componentes, api client, utils...)
docs/           Especificações e planos de cada etapa do desenvolvimento
```

## Pré-requisitos

- [.NET SDK 9](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org/) e npm
- PostgreSQL 15+ rodando localmente (via Docker ou instalação nativa)
- Android Studio (emulador) ou um aparelho Android físico com depuração USB habilitada
- [Expo CLI](https://docs.expo.dev/more/expo-cli/) (`npx expo`, não precisa instalar globalmente)

> O app usa módulos nativos (câmera, geração de PDF) instalados via **dev client customizado** — não funciona no app genérico Expo Go. É necessário rodar `npx expo run:android` (ou `run:ios`) pelo menos uma vez para gerar esse dev client.

## Instalação e execução

### Backend (`api/`)

1. Suba um PostgreSQL local, por exemplo:
   ```bash
   docker run --name postgres-flanelinha -e POSTGRES_PASSWORD=123 -p 5432:5432 -d postgres
   ```
2. Copie o arquivo de configuração local de exemplo e ajuste se necessário:
   ```bash
   cd api
   cp appsettings.Development.json.example appsettings.Development.json
   ```
   `appsettings.Development.json` não é versionado (contém a string de conexão e a chave de assinatura JWT) — os valores do `.example` já funcionam com o container Docker do passo 1, mas troque `Jwt:Key` por uma chave própria caso vá além de uso local.
3. Restaure os pacotes, aplique as migrations e rode a API:
   ```bash
   dotnet restore
   dotnet ef database update
   dotnet run
   ```
   A API sobe por padrão em `http://localhost:5093` (ver `Properties/launchSettings.json`).

### Mobile (`mobile/`)

1. Copie o arquivo de variáveis de ambiente de exemplo e ajuste a URL da API:
   ```bash
   cd mobile
   cp .env.example .env
   ```
   Em `.env`, `EXPO_PUBLIC_API_URL` deve apontar para o endereço onde a API está acessível a partir do celular/emulador (em um aparelho físico via USB, use `adb reverse tcp:5093 tcp:5093` e mantenha `http://localhost:5093`).
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Gere e instale o dev client no dispositivo/emulador (necessário apenas na primeira vez ou após adicionar uma dependência nativa):
   ```bash
   npx expo run:android
   ```
4. Nas próximas execuções, basta subir o Metro bundler e abrir o dev client já instalado:
   ```bash
   npx expo start --dev-client
   ```

## Variáveis de ambiente

| Local | Arquivo | Variável | Descrição |
|---|---|---|---|
| `mobile/` | `.env` (não versionado; ver `.env.example`) | `EXPO_PUBLIC_API_URL` | URL base da API consumida pelo app |
| `api/` | `appsettings.Development.json` (não versionado; ver `.example`) | `ConnectionStrings:DefaultConnection` | String de conexão do PostgreSQL |
| `api/` | `appsettings.Development.json` (não versionado; ver `.example`) | `Jwt:Key` | Chave de assinatura do JWT |

Nenhum arquivo com segredos reais é versionado — apenas os `.example` (`mobile/.env.example`, `api/appsettings.Development.json.example`), com valores de desenvolvimento local que não são usados em produção. `api/appsettings.json`, que continua versionado, guarda só o que não é segredo (`Jwt:Issuer`, `Jwt:Audience`, `Jwt:ExpiresInMinutes`).

## Histórico de desenvolvimento

O projeto foi desenvolvido em etapas incrementais (autenticação, telas do Fiscal, telas do Flanelinha, foto + exportação em PDF), cada uma com sua própria sequência de commits. O histórico completo pode ser consultado com `git log`.

## Status do projeto

🚧 Em desenvolvimento / uso educacional.

## Licença

Projeto acadêmico, sem licença definida até o momento.
