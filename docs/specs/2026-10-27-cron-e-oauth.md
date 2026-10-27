# A rotina diária e a conexão do Instagram com porteiro

**Nascido em:** 27/10/2026, sobre a `main` em `a1df505`, dos achados médios da varredura de segurança de
26/10. **Decisão do Eduardo pela caixa, em 27/10:** os dois consertos, e o webhook com várias chaves fica
como o Vinícius desenhou.

---

## O que estava aberto

1. **A rotina diária libera sem senha** (`app/api/cron/daily/route.ts:17-19`):
   `if (secret && !safeEqualSecret(...))`.
   - Onde a `CRON_SECRET` não existe, qualquer pedido roda a rotina inteira: renovar tokens, atualizar
     perfis, encerrar lotes e drenar a fila.
   - A `CRON_SECRET` só está no ambiente de produção da Vercel, então nos previews (que leem o banco de
     produção) a rotina fica aberta para quem passar pelo login da Vercel.
   - O tique da fila (`app/api/queue/tick/route.ts`) já recusa nesse caso (`!secret ||`).
2. **A conexão do Instagram usa um `state` fixo e começa sem login:**
   - `oauthState()` (`lib/auth.ts:68-71`) é sempre o mesmo HMAC. Ele é derivado da senha do painel e vale
     até a próxima troca dela.
   - A rota que começa a conexão (`app/api/oauth/login/route.ts`) é pública (`/api/oauth` está na
     `PUBLIC_PREFIXES`) e entrega esse `state` a qualquer um.
   - Com ele, dá para montar a armadilha clássica do OAuth: levar o dono a terminar uma conexão que outra
     pessoa começou e conectar ao painel a conta errada.
   - Hoje isso é contido porque o app da Meta só autoriza contas cadastradas como testadoras, mas não deveria
     depender disso.

## O que muda

1. **`app/api/cron/daily/route.ts`:** sem `CRON_SECRET`, a rotina recusa com 401, como o tique.
   - Na produção nada muda: a variável existe, e a Vercel manda `Authorization: Bearer <segredo>` no cron.
2. **A conexão do Instagram:**
   - **`/api/oauth/login`:** confere a sessão do painel. Sem ela, manda para `/entrar` sem entregar `state`
     nenhum.
     - Com ela, gera um `state` aleatório novo (32 bytes) e o guarda num cookie próprio,
       `metodochat_oauth_state`: httpOnly, secure em produção, sameSite lax, path `/api/oauth` e 10 minutos.
     - Depois redireciona para o Instagram com esse `state`.
   - **`/api/oauth/callback`:** confere o `state` que volta contra o cookie, em tempo constante. Sem cookie,
     ou com valores diferentes, recusa como hoje ("state inválido").
     - O cookie é apagado na resposta, dê certo ou não, então cada `state` serve uma vez.
     - O sameSite lax deixa o cookie ir junto quando o Instagram devolve o navegador ao callback, porque é
       uma navegação de topo.
   - **`lib/auth.ts`:** sai o `oauthState()` fixo, e entram o gerador do `state` e o nome do cookie.
3. **O teste do Vinícius que chamava o cron sem senha** (`testes-integracao/publicacao.integracao.ts`): ele
   passa a configurar uma `CRON_SECRET` de teste e a mandar o mesmo cabeçalho que a Vercel manda. Nenhuma
   autorização é forjada, e o caso continua medindo o que media.

## O que fica de fora, e por quê

**O webhook com várias chaves** (`app/api/webhook/route.ts:112-117`): é desenho do dono, explicado em
`lib/webhook-signature.ts`.
- O app do Instagram tem duas chaves fáceis de confundir, e a Meta assina com a do app. Aceitar só uma faria
  a instalação que salvou a outra recusar 100% dos eventos, sem aviso.
- Não dá para medir qual das duas assina os eventos daqui, porque o painel não guarda o corpo cru.
- O ganho seria pequeno: forjar um evento exige uma das chaves secretas de qualquer jeito.
- Fica registrado como aceito.

## Os testes, escritos antes do código

- **`testes-integracao/cron-e-oauth.integracao.ts`, no container:**
  - **a rotina diária:** sem `CRON_SECRET`, dá 401 e não drena nada; com o segredo e o cabeçalho errado, dá
    401; com o cabeçalho certo, roda;
  - **o começo da conexão:**
    - sem sessão, manda para `/entrar` e não grava cookie de `state`;
    - com a sessão de teste (a do login de verdade), manda para o Instagram com um `state` de 64 caracteres
      hexadecimais e grava o cookie com esse mesmo valor, httpOnly e com o path `/api/oauth`;
    - duas conexões seguidas têm `state` diferentes;
  - **a volta da conexão:**
    - sem cookie, recusa com "state inválido";
    - com cookie diferente do `state`, recusa igual;
    - com os dois iguais, passa da conferência (cai no passo seguinte, a falta do App ID, sem chamar a
      Meta);
    - nos três casos, a resposta apaga o cookie.
- **`testes-integracao/publicacao.integracao.ts`:** o caso do cron, com o segredo de teste e o cabeçalho.

**Medido sobre a `main`:** caem 7 dos 9 casos (o cron sem segredo, os três do começo e os três da
volta).
- Os 2 que passam guardam o que já estava certo: o cabeçalho errado é recusado e o cron autorizado roda.
- O cron autorizado é provado pelo lote guardado e vencido que ele encerra. O dreno volta cedo quando não há
  conta conectada, e por isso o primeiro rascunho, com um item pendente, não media nada.
- O lote é montado com `jsonb_build_object`: serializado à mão, ele virava uma string jsonb.

**As mutações, cada uma derrubando o caso certo:**
- a rotina liberando sem segredo derruba o caso dela;
- o começo sem conferir a sessão derruba o "sem sessão";
- o state fixo de novo derruba o "duas conexões";
- a volta aceitando sem conferir o cookie derruba os dois de recusa;
- a volta sem apagar o cookie derruba os três da volta.

## A prova, no preview

Sem gravar nada além do login: o Eduardo, logado no preview, abre a Configuração e clica em "Conectar outra
conta" até a tela de autorização do Instagram, e **não autoriza**.
- O endereço dessa tela tem de trazer um `state` diferente a cada clique. Antes, era sempre o mesmo.
- O "sem sessão" fica com o teste: um pedido sem cookie ao preview exigiria um link que pula o login da
  Vercel, e esse tipo de link já foi evitado nesta varredura.
