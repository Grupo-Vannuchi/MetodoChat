import { describe, it, expect } from "vitest";
import { sslDaUrl } from "../lib/conexao";

// O QUE ESTE ARQUIVO FIXA: a exceção de TLS vale para a PRÓPRIA MÁQUINA e para
// mais nada. Ela existe para a suíte poder rodar contra um container local
// (`docker-compose.yml`, 15/09/2026), onde a imagem `postgres` oficial não
// serve TLS — e o risco de uma exceção assim é ela crescer sem ninguém ver.

describe("sslDaUrl", () => {
  it("exige TLS em servidor de verdade", () => {
    expect(sslDaUrl("postgres://u:s@db.abc.supabase.co:6543/postgres")).toBe("require");
    expect(sslDaUrl("postgres://u:s@aws-0-sa-east-1.pooler.supabase.com:6543/postgres")).toBe(
      "require"
    );
  });

  it("dispensa TLS só na própria máquina", () => {
    expect(sslDaUrl("postgres://postgres:postgres@localhost:5433/testes")).toBe(false);
    expect(sslDaUrl("postgres://postgres:postgres@127.0.0.1:5433/testes")).toBe(false);
    expect(sslDaUrl("postgres://postgres:postgres@[::1]:5433/testes")).toBe(false);
  });

  it("MAIÚSCULA não abre a porta", () => {
    // `LOCALHOST` é o mesmo servidor, e uma comparação sensível a caixa faria a
    // exceção valer para um e não para o outro.
    expect(sslDaUrl("postgres://u:s@LOCALHOST:5433/t")).toBe(false);
  });

  it("nome que PARECE local não conta", () => {
    // O modo clássico de uma exceção dessas vazar é virar "começa com" ou
    // "contém". Estes três casam por substring e NÃO podem passar.
    expect(sslDaUrl("postgres://u:s@localhost.evil.com:5432/t")).toBe("require");
    expect(sslDaUrl("postgres://u:s@meu-localhost:5432/t")).toBe("require");
    expect(sslDaUrl("postgres://u:s@127.0.0.1.evil.com:5432/t")).toBe("require");
  });

  it("rede interna NÃO é a própria máquina", () => {
    // 192.168.x e 10.x são outra máquina, com rede no meio. A lista é fechada.
    expect(sslDaUrl("postgres://u:s@192.168.1.50:5432/t")).toBe("require");
    expect(sslDaUrl("postgres://u:s@10.0.0.7:5432/t")).toBe("require");
  });

  it("URL ilegível cai no lado seguro", () => {
    expect(sslDaUrl("isto nao e uma url")).toBe("require");
    expect(sslDaUrl("")).toBe("require");
  });
});
