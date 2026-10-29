"use client";
import { useSyncExternalStore } from "react";

// O FUSO DO NAVEGADOR NUM FORMULÁRIO DE SERVIDOR (achado 121).
//
// O `<input type="datetime-local">` manda "14:30" e CALA sobre onde são 14:30;
// lido no servidor, que roda em UTC, isso seria 14:30Z (ver
// `instanteDoAgendamento`). O fuso vem do navegador, e ele só existe lá.
//
// ELE MORAVA NUM CAMPO ESCONDIDO com `defaultValue` vazio, preenchido por um
// `<Script>` de id fixo, e isso falhava de dois jeitos. O `<Script>` do Next com
// o mesmo id roda UMA VEZ por documento: uma sonda mediu em 19/10, no `next dev`
// e no `next start`, com o fuso de Manaus, que o post aberto por carga inteira
// mandava "240", e o segundo post aberto por Link, como do calendário, mandava
// vazio. E um novo desenho da página devolve o campo de `defaultValue` ao valor
// inicial (medido no compositor no mesmo dia). Vazio, `fusoDoCampo` cai no fuso
// de Brasília, e quem remarcava em outro fuso via o post sair na hora errada.
//
// AGORA O CAMPO É DE CLIENTE, CONTROLADO. O servidor o escreve vazio (ele não
// sabe onde a pessoa está), a hidratação passa ao valor do navegador, e um novo
// desenho não o apaga, porque o valor é do componente. Sem JavaScript ele fica
// vazio, e a action cai no fuso do painel, que é a rede de sempre. A mesma
// sonda, com este campo no lugar, mediu em 27/10 no `next start` do 16.4.3 que
// todo post manda "240", também o segundo aberto por Link.
//
// O NOME DO CAMPO VEM DE QUEM MONTA O FORMULÁRIO: é a página que sabe o que a
// action lê, e o `name=fuso` continua à vista na árvore dela, que é onde
// testes-integracao/agendados.integracao.ts o procura.
const nadaMuda = () => () => {};
const doNavegador = () => String(new Date().getTimezoneOffset());
const doServidor = () => "";

export default function CampoDoFuso({ name }: { name: string }) {
  const fuso = useSyncExternalStore(nadaMuda, doNavegador, doServidor);
  return <input type="hidden" name={name} value={fuso} />;
}
