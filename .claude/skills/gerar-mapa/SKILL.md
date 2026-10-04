---
name: gerar-mapa
description: Gera o código MAPDSL de um mapa de RPG para colar no gerador de mapas do rpg-manager (menu Mapas → "Gerar por código"). Use quando pedirem um mapa, masmorra, cidade, calabouço, planta de local, ou para editar/expandir um mapa existente a partir do seu código.
---

# Gerar mapa em MAPDSL

Produz o código que o botão **Mapas → Gerar por código** do rpg-manager transforma
em mapa pronto, com os nós já posicionados.

A gramática completa está em [reference/notacao.md](reference/notacao.md). Leia esse
arquivo antes de escrever o código — ele é a fonte da verdade e espelha o parser em
[client/src/components/map/mapDsl.ts](../../../client/src/components/map/mapDsl.ts).

## Fluxo

1. **Entenda o pedido.** Extraia: tema/ambientação, escala (quantos locais), se há
   um ponto de entrada e um objetivo, e se o grupo deve poder circular em ciclo ou
   só avançar em linha.
2. **Esboce a topologia antes das coordenadas.** Liste os locais e quem conecta com
   quem. Um mapa bom tem gargalos (um único caminho para a área final), atalhos
   opcionais e pelo menos um beco sem saída com recompensa ou risco.
3. **Desenhe na grade.** Trate `col,row` como papel quadriculado: `0,0` é o centro,
   `col` cresce para a direita, `row` cresce para **baixo**. Mantenha simetria em
   torno de `col=0` — se existe uma ala em `2,-1`, a contraparte vai em `-2,-1`.
4. **Escreva o código** seguindo a gramática.
5. **Confira** com o checklist abaixo.
6. **Entregue apenas o bloco de código**, seguido de uma linha dizendo para colar em
   Mapas → Gerar por código.

## Escolhendo o posicionamento

Dê coordenadas explícitas a todos os nós sempre que a forma do lugar importar
(uma masmorra tem geografia). Só omita todas as coordenadas e deixe o `LAYOUT`
resolver quando o mapa for abstrato — teia de contatos, rede de portais, mapa de
relações entre facções.

| Situação | Escolha |
| --- | --- |
| Masmorra, edifício, região com geografia própria | coordenadas explícitas |
| Progressão linear por níveis/andares | `LAYOUT layers`, sem coordenadas |
| Local central com ramificações | `LAYOUT radial`, sem coordenadas |
| Poucos locais todos interligados | `LAYOUT ring`, sem coordenadas |
| Grade regular (cripta modular, catacumba) | coordenadas explícitas em malha |

Nunca misture: ou todos os nós têm coordenada, ou nenhum tem. O parser aceita a
mistura, mas o resultado fica menos previsível.

## Checklist antes de entregar

- [ ] Todo id usado em `P` existe em algum `N`.
- [ ] Nenhuma coordenada repetida entre dois nós.
- [ ] Nenhum `|` dentro de descrições ou rótulos.
- [ ] Decimais com ponto (`0.5`), nunca com vírgula.
- [ ] Características só do conjunto: `dificil`, `sem_visao`, `salto`, `instavel`,
      `perigoso`, `bloqueado`.
- [ ] Grafo conexo — nenhum nó ilhado sem querer.
- [ ] Distâncias coerentes com o tamanho dos locais (2-3 m entre salas vizinhas,
      6-15 m em corredores longos ou vãos externos).
- [ ] Capacidade condizente com a ficção: nicho 1-2, sala comum 4-6, salão 8-15.
- [ ] No máximo ~25 nós, ou o mapa deixa de ser legível na tela.

## Editando um mapa existente

O editor exporta o mapa atual em MAPDSL pelo botão **Código** (modo Canvas). Se o
usuário colar esse código pedindo mudanças, edite as linhas necessárias e devolva o
código **inteiro** — a importação substitui o mapa, não faz merge. Preserve os ids
existentes para que os caminhos continuem válidos.
