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
