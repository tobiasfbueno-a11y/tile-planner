# Tile Planner — app funcional no seu iPhone

App web (PWA) que tira foto da parede + foto do tile, calcula o melhor
layout de instalação (mesmo com paredes tortas) e gera uma visualização
com o tile aplicado usando IA (Google Gemini).

Não precisa de Xcode, App Store, nem servidor pago.

## 1. Ative o faturamento e pegue sua chave da API do Gemini

1. Acesse **https://aistudio.google.com/apikey**
2. Faça login com sua conta Google
3. Confirme que o projeto associado tem **faturamento ativado** — sem isso,
   a API de geração de imagem recusa com erro de cota, mesmo tendo saldo
4. Clique em "Create API key" (ou use uma já existente)
5. Copie a chave (começa com `AIza...`) — você vai colar dentro do app depois

Custo por imagem gerada é baixo (geralmente poucos centavos de dólar).

## 2. Publique o app no GitHub Pages (grátis, sem terminal)

1. Crie uma conta em **github.com** se ainda não tiver
2. Crie um repositório novo, público, com o nome `tile-planner`
3. Na página do repositório, clique em **Add file → Upload files**
4. Arraste TODOS os arquivos desta pasta (`index.html`, `style.css`,
   `app.js`, `manifest.json`, `sw.js`, `icon.png`) e clique em **Commit changes**
5. Vá em **Settings → Pages**
6. Em "Branch", selecione `main` e pasta `/ (root)`, clique **Save**
7. Espere ~1 minuto. O GitHub vai te dar um link tipo:
   `https://seuusuario.github.io/tile-planner/`

Esse link já é o app funcionando — funciona em qualquer navegador,
inclusive no Safari do iPhone.

## 3. Instale no iPhone como app

1. Abra o link do GitHub Pages no **Safari** do iPhone (tem que ser Safari, não Chrome)
2. Toque no ícone de compartilhar (quadrado com seta pra cima)
3. Toque em **"Adicionar à Tela de Início"**
4. Pronto — vai aparecer um ícone como app normal, abre em tela cheia

## 4. Usar o app

1. Passo 1: fotografe o espaço (parede ou piso)
2. Passo 2: digite largura e altura/comprimento em polegadas (meça com trena). Se a
   superfície for irregular, ative o interruptor e informe a medida dos 4 cantos
3. Passo 3: fotografe o tile, digite as medidas dele em polegadas + espessura do
   rejunte, e escolha a **orientação** (horizontal, vertical ou diamante) e o
   **padrão de assentamento** (reto, brick/amarração, 1/3, ou 1/3 espelhado)
4. Passo 4: cole sua chave da API do Gemini (só precisa fazer isso uma vez,
   ela fica salva no navegador do seu iPhone)
5. Veja o resultado: diagrama com o layout calculado (quantos tiles, onde
   ficam os cortes, já considerando a orientação e o padrão escolhidos) e uma
   imagem gerada por IA mostrando como fica na prática

## Sobre o cálculo do layout

Por padrão (padrão "reto"), o algoritmo centraliza os tiles no espaço,
distribuindo os cortes igualmente nas duas bordas (em vez de jogar toda sobra
pra um lado só, que fica feio). Nos padrões com deslocamento (brick, 1/3, 1/3
espelhado), cada fileira é deslocada horizontalmente e os cortes variam
fileira a fileira — isso é normal e esperado nesse tipo de assentamento. No
layout diamante, o cálculo já soma ~15% de material extra para os cortes
triangulares das bordas (estimativa — confirme com quem for instalar). O app
sempre avisa se algum corte ficar fino demais (frágil e visualmente ruim) e,
no caso de superfícies irregulares, recomenda como nivelar e ajustar cortes
na última fileira.

Todas as medidas do app são em **polegadas** (padrão EUA).

## Atualizando o app depois

Sempre que eu (ou você) mudar algo no código, é só repetir o passo 2.3
(upload dos arquivos novos, "Commit changes") — o link continua o mesmo
e atualiza sozinho.

## Limitações atuais (V1)

- A medida da parede é manual (trena), não por câmera/LiDAR — mais confiável
  e simples de programar sem app nativo
- A imagem gerada por IA é uma aproximação visual, não uma renderização
  arquitetônica exata
- Precisa de internet para gerar a imagem com IA (o cálculo do layout
  funciona offline)
