# Tile Planner — app funcional no seu iPhone

App web (PWA) que tira foto da parede + foto do tile, calcula o melhor
layout de instalação (mesmo com paredes tortas) e gera uma visualização
com o tile aplicado usando IA (Google Gemini).

Não precisa de Xcode, App Store, nem servidor pago.

## 1. Pegue uma chave grátis da API da Pollinations

1. Acesse **https://enter.pollinations.ai**
2. Faça login com sua conta do GitHub
3. Crie uma chave do tipo **"publishable"** (vai começar com `pk_`)
4. Copie a chave — você vai colar dentro do app depois

Não pede cartão de crédito. O uso do app fica dentro da cota gratuita
("pollen") renovada periodicamente pela plataforma.

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

1. Passo 1: fotografe a parede do banheiro
2. Passo 2: digite largura e altura (meça com trena). Se a parede for torta,
   ative o interruptor e informe a altura dos 4 cantos
3. Passo 3: fotografe o tile e digite as medidas dele + espessura do rejunte
4. Passo 4: cole sua chave da API da Pollinations (só precisa fazer isso uma
   vez, ela fica salva no navegador do seu iPhone)
5. Veja o resultado: diagrama com o layout calculado (quantos tiles, onde
   ficam os cortes) e uma imagem gerada por IA mostrando como fica na prática

## Sobre o cálculo do layout

O algoritmo centraliza os tiles na parede, distribuindo os cortes igualmente
nas duas bordas (em vez de jogar toda sobra pra um lado só, que fica feio).
Ele avisa se algum corte ficar fino demais (frágil e visualmente ruim) e,
no caso de paredes tortas, recomenda nivelar pela fileira de baixo/cima e
ajustar cortes individualmente na última fileira.

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
