# O gerador de bônus — Etapa 9: o slide que não cabe não sai

**Nascido em:** 08/10/2026, desenhado com o Eduardo pela caixa de perguntas, sobre a `main` em
`c0c635c` (a Etapa 8 em produção desde 08/10, 15:08Z). É o passo curto que o Eduardo decidiu na prova
da Etapa 8 ("Bloquear, depois desta etapa"), para o achado 87 da auditoria.
**Estado:** desenho aprovado pelo Eduardo; revisado pela auditoria, com a ordem no servidor, o efeito
na produção (confirmado pelo Eduardo) e o "quem manda é o servidor" absorvidos.
**Projeto de quem:** do Vinícius Gualberto. Como as etapas anteriores, entra como visita: pasta
própria, e nenhum arquivo do `/publicar` nem das automações muda.
**Etapas anteriores:** a Etapa 5 (`docs/specs/2026-10-05-publicar-do-carrossel.md`), que publica, e a
Etapa 8 (`docs/specs/2026-10-08-carrossel-sem-palavra.md`), cuja prova achou o problema.

---

## O que é

Na prova da Etapa 8, o texto do slide 1 era uma palavra de 71 letras, sem espaço. O card do slide
avisou que o texto não cabia, e mesmo assim o agendar passou: na arte que foi para a fila, a palavra
passava da margem e saía cortada na borda direita (achado 87). O "não cabe" só existe como aviso no
card do slide (`app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx:110`); o publicar e o agendar não o
conferem. O caso real é uma palavra mais larga que a linha, como um link comprido, ou um texto com
mais linhas do que o espaço comporta.

Esta etapa faz o publicar e o agendar recusarem o slide que sairia cortado na imagem publicada, com a
frase dizendo qual slide corrigir e como.

---

## As decisões, e de quem

Do Eduardo, pela caixa, em 08/10:

| assunto | decisão |
|---|---|
| o que fazer com o slide que não cabe | bloquear o publicar e o agendar, num passo curto depois do merge da Etapa 8 (o caminho 1 do achado 87) |
| qual slide barra | todo slide que sai cortado na imagem publicada: o "Só texto" cujo texto não cabe sem o espaço da imagem, e o slide com foto cujo texto não cabe com o espaço. O slide pronto do Canva não entra, porque não usa a arte do Chat |
| o desenho (o botão travado com a frase, a recusa no servidor, o editor só avisando, sem banco) | aprovado como está nesta spec |
| o efeito nos carrosséis que já existem (abaixo) | mantém: barrar todo slide que sai cortado, depois de saber que 3 dos 5 carrosséis de hoje travam com foto num slide |

**A regra antiga que muda, e onde.** O comentário de `slidesQueNaoCabem`
(`lib/bonus/arte-slides.ts:277`) registra a regra que veio do Labs: "AVISA, NUNCA IMPEDE … Aviso que
trava publicação é aviso que alguém desliga". Ela continua valendo no editor: o card avisa, e salvar
um slide que não cabe continua permitido. A decisão do Eduardo vale só no publicar e no agendar, onde
o problema deixa de ser um aviso e vira uma imagem cortada na rede social. O `arte-slides.ts` não muda
(é a conta combinada com o Labs); o comentário do bloqueio fica no módulo novo da regra.

---

## A tela

- **O card "Publicar"** ganha um motivo novo para travar o botão, ao lado dos de hoje (a conta, as
  imagens que faltam, o que está "não salvo"; `faltasParaPublicar`, `lib/bonus/publicar-estado.ts:76`):
  "O texto do slide 2 não cabe na arte e sairia cortado. Encurte o texto." No slide com foto, a frase
  acrescenta: "ou marque "Só texto"". Com mais de um slide, a frase lista os números. Vale para
  "Agora" e para "Agendar", que são o mesmo botão.
- **O card do slide** continua com o aviso de hoje (`avisosDeCabimento`,
  `lib/bonus/arte-cabimento.ts:56`), sem mudança.
- **O "Escrever à mão"** do "Novo carrossel" continua sem o aviso: o carrossel nasce, e a página dele
  mostra o aviso nos cards (fora desta etapa).

---

## Por dentro

### A regra, pura

Uma função pura nova, num módulo da publicação (`lib/bonus/publicar-regras.ts` ou um módulo ao lado),
responde, para cada slide, se ele sai cortado:

- **o slide pronto do Canva** (com espaço e com a imagem do jeito `slide`): nunca, porque sai a
  imagem dele, e não a arte;
- **o "Só texto"**: sai cortado quando o texto não cabe **sem** o espaço da imagem
  (`tamanhoDoSlide(s, false).cabe`, `lib/bonus/arte-slides.ts:199`);
- **o slide com foto no espaço**: sai cortado quando o texto não cabe **com** o espaço
  (`tamanhoDoSlide(s, true).cabe`);
- **o slide com espaço e sem imagem**: não conta aqui, porque o publicar já o recusa por falta de
  imagem.

A conta é a mesma do aviso do card (`slidesQueNaoCabem`, `:280`, usa o mesmo `tamanhoDoSlide`), feita
no modo em que o slide sai. Por isso o slide que o botão barra é sempre um slide que o card avisa.

### No servidor

`publicarNaFila` (`lib/bonus/publicar-processo.ts`) confere a regra com o texto salvo, as escolhas da
arte (o `soTexto`) e as imagens guardadas. **A ordem importa:** o `descartar` só existe depois das
imagens que faltam (`:179-181`), junto da conferência do `caminho_na_fila` (`:190-200`). A conferência
nova entra depois dele e da conferência do `caminho_na_fila`, e antes da conferência das artes, da
reserva e da fila; assim as artes subidas saem do bucket na recusa. (Fora do escopo: a recusa
`faltam_imagens` de hoje vem antes do `descartar` e não apaga as artes subidas.) A recusa nova é `{ motivo: "nao_cabe"; slides: number[] }`
(`RecusaDaPublicacaoDoCarrossel`, `lib/bonus/publicar-textos.ts:182`), com a mesma frase da tela. As
artes que o navegador já tiver subido para a fila são apagadas, como nas outras recusas depois delas
(`descartar`, `:196`). Nada é reservado, e nada entra na fila.

### Na tela

O editor (`editor-do-carrossel.tsx`) não guarda o texto salvo de cada parte: cada card guarda o seu.
Como o "não salvo" de hoje (`aoMudarNaoSalvo`), cada card de slide avisa o editor quando o slide dele
passa a sair cortado ou deixa de sair, pela mesma regra pura, com o texto dos campos dele, o "Só texto"
e o jeito da imagem. O editor passa a lista ao card "Publicar", e `faltasParaPublicar` ganha a falta
`{ tipo: "nao_cabe"; slides }`. Como o botão já trava com qualquer parte "não salva", quando ele está
livre o texto dos campos é o texto salvo, e a tela e o servidor contam sobre o mesmo texto.

**Quem manda é o servidor.** O "Só texto" muda na tela no clique, antes de a gravação responder; numa
recusa da gravação, a caixa volta à última escolha aceita (`editor-do-carrossel.tsx:92-93`, e o teste
de tela "na recusa, o só texto volta para a última escolha aceita"). Nesse intervalo, a tela pode
medir um slide num modo, e o servidor no outro. Num descompasso assim, vale a recusa do servidor, e a
frase dela aparece no card "Publicar", como as outras recusas (um caso de tela confere).

### O que não muda

- A arte, o desenho, a conta do "não cabe" e os vetores combinados com o Labs.
- O salvar de cada slide, que continua aceitando o texto que não cabe (o card avisa).
- O banco: nenhuma migração.
- Nenhum arquivo do `/publicar`, do bucket, do dreno, da fila nem das automações. O diff fica em
  `app/bonus/`, `lib/bonus/`, testes e `docs/`.

---

## O efeito na produção

Medido pela auditoria em 08/10, só lendo, com a conta de hoje: dos 5 carrosséis que existem, 3 têm um
slide cujo texto não cabe COM o espaço da foto (o slide 1 do `e6af940e`, o 2 do `4c5701a8` e o 6 do
`d3619afc`); sem o espaço, todos cabem. Depois desta etapa, publicar ou agendar um desses com foto
nesse slide trava até marcar "Só texto" nele, encurtar o texto ou usar o slide pronto do Canva. Hoje
ele sairia com o texto cortado. O Eduardo soube disso antes e manteve a decisão. Na fila não há
publicação pendente de nenhum deles (medido pela auditoria depois da prova da Etapa 8).

---

## Testes

| suíte | o quê |
|---|---|
| pura | a regra: o "Só texto" que não cabe sem o espaço sai cortado; o com foto que não cabe com o espaço sai cortado; o com foto que cabe com o espaço passa; o slide pronto do Canva nunca sai cortado, mesmo com o texto que não cabe; a palavra de 71 letras da prova sai cortada |
| pura | a falta nova em `faltasParaPublicar`, na ordem das outras, e a frase dela, com um e com vários slides, com e sem a parte do "Só texto" |
| pura | a recusa nova e a frase dela, iguais às da tela |
| integração | o publicar e o agendar de um carrossel com um slide que sai cortado são recusados, as artes subidas saem do bucket, nada entra na fila e nada é reservado; o mesmo carrossel, com o slide marcado como pronto do Canva, publica |
| tela | o botão "Publicar" trava com a frase quando um card avisa que sai cortado, e destrava quando o texto passa a caber |
| tela | a recusa `nao_cabe` do servidor aparece no card "Publicar" com a frase dela |

Cada proteção principal ganha uma prova de mutação: retirada de propósito, o teste certo cai.

---

## A prova real

No preview, com o Eduardo na tela. Cada gravação tem o OK dele, e a auditoria lê o banco antes e
depois. O preview usa o banco e o bucket de produção. **Sem post real.** Sem migração.

1. "Novo carrossel" → texto livre → "Escrever à mão", com 1 slide e uma palavra comprida, sem espaço,
   no texto da imagem; criar (grava).
2. Na página dele: subir uma foto no slide (grava), e ver o botão "Publicar" travado com a frase do
   slide 1.
3. Encurtar o texto e salvar o slide (grava): o botão destrava.
4. Agendar para daqui a 7 dias e cancelar no calendário (gravam).

No fim, o que a prova criou sai do banco e do bucket, com o OK do Eduardo e o script lido pela
auditoria antes de rodar (achado 77).

---

## Pré-condições do merge

1. `npm run verify` limpo, a integração verde no container, e o preview com a prova feita.
2. Nenhuma migração: o build do merge diz "Nada a aplicar".
3. Nenhum `next dev` apontado para a produção durante o deploy, e as abas recarregadas depois.

---

## Fora desta etapa

- O aviso do "não cabe" no "Escrever à mão" do "Novo carrossel".
- Encolher a fonte abaixo do piso ou quebrar a palavra comprida na arte: a conta e o desenho são os
  combinados com o Labs, e não mudam aqui.
