# TypeScript Style Guide & Coding Standards

Este documento estabelece as diretrizes e padrões oficiais de código TypeScript para o projeto **linkedin-mcp-server-ts**, derivado do **Google TypeScript Style Guide** e do **ts.dev**, adaptado para o ecossistema moderno com **Bun**, **Biome**, **Model Context Protocol (MCP)** e **Zod**.

---

## 1. Formatação & Tooling

- **Autoridade de Formatação**: O **Biome** (`bun run format` / `bun run lint`) é a única fonte de verdade para formatação de código.
  - Indentação: **Tabs**.
  - Comprimento máximo de linha: **130 colunas**.
  - Aspas: **Aspas duplas** (`"`) para strings normais e imports.
- Não gaste tempo de code review discutindo posicionamento de vírgulas, quebras de linha ou espaçamento; deixe o Biome formatar automaticamente.

---

## 2. Nomenclatura & Identificadores

| Categoria | Convenção | Exemplo |
| :--- | :--- | :--- |
| **Arquivos e Diretórios** | `kebab-case` | `connection-state.ts`, `text-utils.test.ts` |
| **Classes, Interfaces, Types, Enums, Decorators** | `UpperCamelCase` | `AppConfig`, `LinkedInScraperException` |
| **Variáveis, Funções, Métodos, Propriedades** | `lowerCamelCase` | `parseArgs`, `resolveConversationThreadUrls` |
| **Constantes Globais / `static readonly`** | `CONSTANT_CASE` | `DEFAULT_PORT`, `LINKEDIN_BASE` |
| **Type Parameters (Genéricos)** | `UpperCamelCase` ou letra única maiúscula | `T`, `TData`, `TResponse` |

### Regras Complementares de Nomenclatura
- **Sem prefixos húngaros ou decorativos**: Não use prefixo `I` em interfaces (use `AppConfig`, nunca `IAppConfig`). Não use prefixo/sufixo `_` para propriedades privadas.
- **Acrônimos**: Trate acrônimos como palavras em `camelCase` (ex.: `loadHttpUrl`, `userId`, `mcpServer`), a menos que o nome de uma API/plataforma externa exija explicitamente (ex.: `XMLHttpRequest`).
- **Nomes Descritivos**: Variáveis devem ser claras e autoexplicativas. Nomes de uma letra (`i`, `k`, `v`) só são permitidos em escopos locais com menos de 10 linhas (ex.: callbacks de `map` ou loops curtos).

---

## 3. Sistema de Tipos: `interface` vs. `type`

### Quando usar `interface`
Use `interface` para definir **estruturas de dados, contratos de objetos, configurações e assinaturas de APIs/serviços**:
```ts
export interface AppConfig {
	host: string;
	port: number;
	transport: "stdio" | "streamable-http";
}

export interface BrowserManager {
	launch(): Promise<void>;
	close(): Promise<void>;
}
```
*Vantagens*: O compilador TypeScript otimiza a verificação de propriedades e fornece mensagens de erro estruturadas e extensibilidade transparente.

### Quando usar `type`
Use `type` para **Uniões Discriminadas**, **Branded Types**, **Interseções**, **Tuplas**, **Tipos Mapeados/Condicionais** e derivações diretas do Zod:
```ts
// 1. Discriminated Unions (Máquinas de Estado)
export type ConnectionState =
	| { status: "connectable"; actionText: string }
	| { status: "already_connected" }
	| { status: "pending" }
	| { status: "unavailable" };

// 2. Branded Types (Segurança de Domínio)
export type ProfileId = string & { readonly __brand: "ProfileId" };

// 3. Tipos inferidos de esquemas Zod
export type SendMessageInput = z.infer<typeof SendMessageSchema>;
```

---

## 4. Enums vs. Const Assertions & Literal Unions

- **Proibido o uso de `enum` tradicional do TypeScript**.
- Utilize uniões de literais de string ou arrays imutáveis com `as const`:
```ts
// Preferencial: União de literais
export type TransportMode = "stdio" | "streamable-http";

// Preferencial quando a lista também precisa ser iterável em runtime:
export const LOG_LEVELS = ["DEBUG", "INFO", "WARNING", "ERROR"] as const;
export type LogLevel = typeof LOG_LEVELS[number];
```

---

## 5. Nullability, Type Safety e Assertions

- **Banido o operador `!` (*non-null assertion*)**:
  - Trate a ausência de valores defensivamente com narrowing explícito (`if (val == null)`), type predicates ou lançamento de erro de validação.
- **Evite `as Type` inseguro**:
  - Nunca use `as any` ou cast forçado de tipos incompatíveis.
  - Para dados externos (CLI, rede, JSON, scraping DOM), use esquemas **Zod** (`schema.parse(...)` ou `schema.safeParse(...)`) na fronteira da aplicação.
- **Exhaustive switch com `never`**:
  - Garanta que todos os ramos de uma união discriminada sejam tratados pelo compilador:
```ts
function handleState(state: ConnectionState): string {
	switch (state.status) {
		case "connectable":
			return `Disponível: ${state.actionText}`;
		case "already_connected":
			return "Conectado";
		case "pending":
			return "Pendente";
		case "unavailable":
			return "Indisponível";
		default: {
			const _exhaustive: never = state;
			throw new Error(`Estado não suportado: ${_exhaustive}`);
		}
	}
}
```

---

## 6. Funções, Métodos e Retornos Explícitos

- **Tipos de Retorno Explícitos Obrigatórios**:
  - Todas as funções e métodos **exportados** ou que façam parte da API pública de um módulo devem declarar explicitamente seu tipo de retorno (`: Promise<void>`, `: string[]`, etc.).
  - Funções auxiliares internas de escopo reduzido podem confiar na inferência automática do TypeScript quando o tipo for óbvio.
- **Preferência por Arrow Functions em Callbacks/Expressões**:
  - Use arrow functions em métodos encadeados (`map`, `filter`, `reduce`) e handlers assíncronos.

---

## 7. Módulos & Importações

- **Named Exports**: Prefira sempre exportações nomeadas (`export function ...`, `export interface ...`). Evite `export default` para garantir consistência de auto-import e refatorações no IDE.
- **Importações de Tipos Explícitas (`import type`)**:
  - Importe tipos usando a sintaxe `import type { ... }` para respeitar `"verbatimModuleSyntax": true` e otimizar a resolução do Bun/transpiler.
- **Imports Nativos do Node/Bun**:
  - Use o prefixo de protocolo `node:` para módulos da biblioteca padrão (ex.: `import { homedir } from "node:os"`).

---

## 8. Documentação com TSDoc (Typedoc-compatible)

- Todos os símbolos públicos (interfaces, funções exportadas, classes, ferramentas MCP) devem ser documentados com blocos TSDoc `/** ... */`.
- Utilize tags TSDoc padrão:
  - `@remarks`: Detalhes adicionais, comportamentos ou notas operacionais.
  - `@param`: Descrição do parâmetro (sem tipo redundante entre chaves `{string}`).
  - `@returns`: Descrição do valor retornado.
  - `@throws`: Exceções e erros esperados.
  - `@public`, `@internal`: Nível de visibilidade da API.
- **Evite comentários redundantes**: Não repita apenas o nome da função ou tipos que o TypeScript já declara com clareza.

### Exemplo TSDoc:
```ts
/**
 * Executa a navegação resiliente até o perfil do usuário no LinkedIn.
 *
 * @remarks
 * Aplica delays dinâmicos para respeitar a taxa de requisições e evitar checkpoints de segurança.
 *
 * @param username - O identificador único do perfil no LinkedIn.
 * @returns Os metadados extraídos do perfil.
 * @throws {LinkedInScraperException} Se o perfil não for encontrado ou estiver indisponível.
 * @public
 */
export async function scrapeUserProfile(username: string): Promise<ProfileData> {
	// ...
}
```
