# Flanelinha App
 
Aplicativo mobile para cadastramento e emissão de carteira digital de flanelinhas, desenvolvido como projeto de React Native para desenvolver e aprender a linguagem.
 
## Contexto
 
Na minha cidade Teresina - PI, uma lei regulamentou a atividade dos flanelinhas, mas nunca foi implementado um processo de emissão de carteira de cadastramento. Este projeto propõe uma solução para que Fiscais possam cadastrar flanelinhas e emitir carteiras digitais de identificação através de uma aplicação mobile.
 
## Tech Stack
 
**Mobile**
- React Native (Expo)
- React Navigation
- Axios (consumo da API)
- react-native-qrcode-svg (geração do QR code da carteira)

**Backend**
- ASP.NET Core Web API (.NET 8)
- Entity Framework Core
- PostgreSQL
- JWT (autenticação do Fiscal)

## Modelo de dados
 
O sistema trabalha com três entidades principais:
 
- **Fiscal**: responsável por realizar o cadastramento dos flanelinhas.
- **Flanelinha**: pessoa cadastrada pelo fiscal, vinculada a um ponto de atuação.
- **Carteira**: documento digital emitido para o flanelinha, com histórico de emissões (permite renovação e segunda via).

## Relacionamentos: 
1 - um Fiscal cadastra vários Flanelinhas; 
2 - um Flanelinha pode possuir várias Carteiras ao longo do tempo.

## Modelo Entidade Relacionamento
[Flanelinha_app_der.pdf](https://github.com/user-attachments/files/29651556/Flanelinha_app_der.pdf)

  

## Roadmap (30 dias)
 
| Semana | Foco |
|---|---|
| 1 | Fundamentos RN/Expo, navegação, telas estáticas |
| 2 | Modelagem do banco (PostgreSQL), API .NET, autenticação do Fiscal |
| 3 | Integração app ↔ API: CRUD de Flanelinha, emissão de Carteira |
| 4 | Carteira digital com QR code, polimento de UI, testes e build final |
 
## Status do projeto
 
🚧 Em desenvolvimento.
 
## Licença
 
Projeto acadêmico, sem licença definida até o momento.
