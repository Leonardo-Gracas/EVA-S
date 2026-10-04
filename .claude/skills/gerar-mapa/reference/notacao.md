# MAPDSL — gramática completa

Formato de texto lido por `parseMapDsl` em
`client/src/components/map/mapDsl.ts`. Uma instrução por linha. Linhas em branco e
linhas começando com `#`, `//` ou ``` são ignoradas.

## Cabeçalho

```
MAP <nome do mapa>
GRID <número>          # opcional, padrão 200 — pixels por unidade de grade (60 a 2000)
LAYOUT <modo>          # opcional, padrão radial — só afeta nós SEM coordenada
```

Aliases aceitos: `MAPA`, `GRADE`. O separador pode ser espaço, `:` ou `=`.

Modos de `LAYOUT`:

| Modo | Alias PT | Resultado |
| --- | --- | --- |
| `radial` | `arvore` | Árvore radial a partir do nó mais conectado; cada camada num anel, filhos em setores proporcionais ao tamanho da subárvore. |
| `layers` | `camadas`, `niveis` | Camadas horizontais: profundidade = linha, irmãos distribuídos e centrados. |
| `ring` | `anel`, `circulo` | Todos os nós num único círculo. |
| `grid` | `grade`, `malha` | Malha quadrada centrada. |

Componentes desconexos são posicionados lado a lado, e o mapa inteiro é centrado
na origem no final.

## Nós

```
N | id | Nome | capacidade | col,row | raio | descrição
```

| Campo | Obrigatório | Padrão | Observações |
| --- | --- | --- | --- |
| `id` | sim | — | Curto, sem espaços nem acentos. Normalizado para `a-z0-9_`. É o que os caminhos referenciam. |
| `Nome` | sim | — | Texto exibido dentro do círculo. Cabem ~3 linhas curtas. |
| `capacidade` | não | `4` | Inteiro > 0. Vira `occupancyLimit` (quantas criaturas cabem). |
| `col,row` | não | automático | Coordenada de grade. Decimal com **ponto**. `col` → direita, `row` → **baixo**. |
| `raio` | não | derivado | Pixels, 20 a 80. Sem valor, usa `24 + capacidade * 3.5` limitado à faixa. |
| `descrição` | não | vazio | Texto livre. **Não use `|`.** |

Aliases do prefixo: `N`, `NO`, `NODE`, `SALA`, `LOCAL`.

Formas curtas:

```
N | Salão das Colunas                      # id derivado do nome
N | Salão das Colunas | 8 | 0,-1           # sem id explícito
N | salao | Salão das Colunas | 8          # sem coordenada → layout automático
```

O parser detecta a forma sem id quando o segundo campo é um número puro ou uma
coordenada.

## Caminhos

```
P | origem | destino | distância | características | rótulo
```

| Campo | Obrigatório | Padrão | Observações |
| --- | --- | --- | --- |
| `origem` / `destino` | sim | — | Id do nó, ou o nome exato dele. |
| `distância` | não | `1` | Metros. Aceita decimal com ponto. |
| `características` | não | nenhuma | Separadas por vírgula. Ver tabela abaixo. |
| `rótulo` | não | vazio | Texto curto. **Não use `|`.** |

Aliases do prefixo: `P`, `C`, `PATH`, `CAMINHO`, `CONEXAO`.

Forma alternativa com seta (`>`, `->`, `<->`, `→`):

```
P | entrada > salao | 3 | dificil | Escadaria íngreme
```

Caminhos são bidirecionais. A mesma dupla de nós não pode aparecer duas vezes.

### Características

| Valor | Aliases | Significado no jogo |
| --- | --- | --- |
| `dificil` | `difficult`, `df` | Terreno difícil — custa movimento extra. |
| `sem_visao` | `escuro`, `cego`, `nv` | Não dá para enxergar do outro lado. |
| `salto` | `pulo`, `jump`, `sl` | Exige um salto / teste de atletismo. |
| `instavel` | `unstable`, `in` | Pode ceder; risco de queda. |
| `perigoso` | `perigo`, `dangerous`, `pr` | Dano ou armadilha ao atravessar. |
| `bloqueado` | `fechado`, `blocked`, `bl` | Fechado até algo destravá-lo. |

## Tolerância a erros

O parser não aborta em erro comum de IA. Ele separa:

- **Erros** (bloqueiam a importação): nenhum nó encontrado.
- **Avisos** (a linha é ignorada, o resto entra): tipo de registro desconhecido,
  linha solta sem `|`, capacidade/coordenada/raio/distância inválidos, característica
  desconhecida, id duplicado (renomeado para `id_2`), caminho apontando para nó
  inexistente, caminho de um nó para ele mesmo, caminho duplicado.

Ainda assim, escreva o código correto: os avisos aparecem para o usuário na tela.

## Exemplo

```
MAP Cripta de Vhalor
GRID 200
LAYOUT radial

# N | id | Nome | cap | col,row | raio | descrição
N | entrada    | Entrada da Cripta   | 4 | 0,2   |    | Portas de bronze rachadas, cobertas de limo.
N | salao      | Salão das Colunas   | 8 | 0,1   | 55 | Doze colunas quebradas sustentam o teto ruído.
N | ala_leste  | Ala Leste           | 3 | 1,0   |    | Nichos funerários vazios.
N | ala_oeste  | Ala Oeste           | 3 | -1,0  |    | Restos de um altar derrubado.
N | tumba      | Tumba de Vhalor     | 6 | 0,-1  | 60 | O sarcófago está aberto. Algo saiu daqui.

# P | origem | destino | distância | características | rótulo
P | entrada   | salao     | 3 | dificil          | Escadaria íngreme
P | salao     | ala_leste | 2 |                  |
P | salao     | ala_oeste | 2 | sem_visao        | Corredor sem tochas
P | ala_leste | tumba     | 4 | perigoso,salto   | Fenda no chão
P | ala_oeste | tumba     | 4 | instavel         |
```

Alinhar as colunas com espaços é opcional — todo campo é trimado.
