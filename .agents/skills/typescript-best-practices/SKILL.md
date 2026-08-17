---
name: typescript-best-practices
description: Use when reading or writing TypeScript or JavaScript files (.ts, .tsx, .js, tsconfig.json).
---

# TypeScript Best Practices & Style Guide

Segue as diretrizes normativas consolidadas em [`.agents/rules/typescript-style.md`](file:///d:/linkedin/linkedin-mcp-server-ts/.agents/rules/typescript-style.md), combinando o **Google TypeScript Style Guide**, **ts.dev** e os padrões modernos do ecossistema Bun/Biome/Zod/MCP.

---

## 1. Modelagem de Tipos: `interface` vs. `type`

- **Use `interface`** para formatos de objetos estruturados, contratos de classes, configurações (`AppConfig`) e opções de APIs/serviços:
  ```ts
  export interface ScraperOptions {
  	timeoutMs: number;
  	headless: boolean;
  	userAgent?: string;
  }
  ```
- **Use `type`** para Uniões Discriminadas, Branded Types, Tipos Utilitários/Mapeados e inferências Zod:
  ```ts
  export type ConnectionState =
  	| { status: "connectable"; actionText: string }
  	| { status: "already_connected" }
  	| { status: "pending" }
  	| { status: "unavailable" };
  ```

---

## 2. Torne Estados Ilegais Irrepresentáveis (*Make Illegal States Unrepresentable*)

Use o sistema de tipos para prevenir estados inválidos em tempo de compilação.

**Uniões discriminadas para estados mutuamente exclusivos:**
```ts
// Bom: apenas combinações válidas são possíveis
type RequestState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };

// Ruim: permite combinações inválidas como { loading: true, error: Error }
type RequestState<T> = {
  loading: boolean;
  data?: T;
  error?: Error;
};
```

**Branded types para primitivos de domínio:**
```ts
type UserId = string & { readonly __brand: "UserId" };
type OrderId = string & { readonly __brand: "OrderId" };

// O compilador impede passar OrderId onde UserId é esperado
function getUser(id: UserId): Promise<User> { /* ... */ }
```

**Const assertions para uniões literais (Banido `enum` tradicional):**
```ts
const ROLES = ["admin", "user", "guest"] as const;
type Role = typeof ROLES[number]; // "admin" | "user" | "guest"

function isValidRole(role: string): role is Role {
  return ROLES.includes(role as Role);
}
```

**Exhaustive switch com checagem `never`:**
```ts
type Status = "active" | "inactive";

function processStatus(status: Status): string {
  switch (status) {
    case "active":
      return "processing";
    case "inactive":
      return "skipped";
    default: {
      const _exhaustive: never = status;
      throw new Error(`Unhandled status: ${_exhaustive}`);
    }
  }
}
```

---

## 3. Nullability & Proibição de Non-Null Assertion (`!`)

- **Nunca utilize `!` (*non-null assertion*)**:
  - Trate potenciais `null` ou `undefined` com type guards defensivos (`if (val == null)`), operadores de coalescência nula (`??`) ou validação com Zod.
  - O linter Biome está configurado para emitir erro em qualquer uso de `!`.

---

## 4. Tipos de Retorno Explícitos em APIs Públicas

Declare explicitamente o tipo de retorno em todas as funções, métodos de classes e ferramentas MCP exportadas:
```ts
// Bom: contrato explícito e auto-documentado
export async function scrapeProfile(username: string): Promise<ProfileData> {
  // ...
}

// Ruim: retorno inferido que pode sofrer breaking changes silenciosas
export async function scrapeProfile(username: string) {
  // ...
}
```

---

## 5. Validação em Runtime com Zod

- Defina esquemas como a única fonte de verdade e infira tipos TypeScript com `z.infer<typeof Schema>`.
- Use `safeParse` para entradas externas/usuário onde falha é esperada; use `parse` em fronteiras de confiança onde dados inválidos representam bug.
- Componha esquemas com `.extend()`, `.pick()`, `.omit()`, `.merge()`.

```ts
import { z } from "zod";

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  createdAt: z.string().transform((s) => new Date(s)),
});

export type User = z.infer<typeof UserSchema>;

export async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) {
    throw new Error(`fetch user ${id} failed: ${response.status}`);
  }
  return UserSchema.parse(await response.json());
}
```

---

## 6. Documentação TSDoc (Typedoc Compatible)

Documente todas as interfaces, funções públicas, classes e ferramentas MCP usando blocos TSDoc:
```ts
/**
 * Inicializa a conexão com o navegador Chrome para automação.
 *
 * @remarks
 * Verifica portas de depuração existentes antes de iniciar uma nova instância.
 *
 * @param config - Configuração operacional da aplicação.
 * @returns Instância gerenciada do navegador conectada.
 * @throws {BrowserLaunchException} Caso o binário do Chrome não seja encontrado.
 * @public
 */
export async function launchBrowser(config: AppConfig): Promise<BrowserSession> {
  // ...
}
```

---

## 7. Módulos & Convenções de Importação

- **Named Exports**: Sempre prefira exportações nomeadas sobre `export default`.
- **Importação de Tipos**: Use `import type { ... }` para respeitar `"verbatimModuleSyntax": true`.
- **Imports Nativos**: Use o prefixo `node:` para módulos da standard library (`import { join } from "node:path"`).
- **Nomenclatura de Arquivos**: Use `kebab-case` para todos os arquivos e diretórios (`connection-state.ts`, `auth-flow.ts`).
