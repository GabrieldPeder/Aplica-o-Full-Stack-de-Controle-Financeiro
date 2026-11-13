# Planos de implementação

Cada PR do projeto tem um plano próprio, escrito antes de começar a implementação.
O plano é do **responsável pelo PR**: ele implementa todas as tarefas do plano, e o outro integrante revisa o PR antes do merge.

O plano de um PR só é escrito quando o PR vai começar, porque depende do que os PRs anteriores entregaram.

| PR | Assunto | Responsável | Revisor | Plano | Situação |
|---|---|---|---|---|---|
| 0 | Fundação | Gabriel | João Vitor | [pr0-fundacao.md](pr0-fundacao.md) | Concluído (#2) |
| 1 | Autenticação | Gabriel | João Vitor | — | A fazer |
| 2 | Categorias + fontes/destinos | Gabriel | João Vitor | — | A fazer |
| 3 | Lançamentos e parcelamento | João Vitor | Gabriel | [pr3-lancamentos.md](pr3-lancamentos.md) | Em andamento |
| 4 | Seed de demonstração | João Vitor | Gabriel | — | A fazer |
| 5 | Relatório por categoria + Dashboard | João Vitor | Gabriel | — | A fazer |
| 6 | Relatório por fonte/destino + Faturas | Gabriel | João Vitor | — | A fazer |
| 7 | Saúde financeira (desafio) | João Vitor | Gabriel | — | A fazer |
| 8 | Acabamento e ensaio da apresentação | Ambos | — | — | A fazer |

## Como um plano é organizado

- **Objetivo:** o que o PR entrega, em uma frase.
- **Regras gerais:** restrições que valem para todas as tarefas (pastas permitidas, bibliotecas, padrão de erro).
- **Casos de atenção:** situações fáceis de esquecer e que precisam de teste.
- **Tarefas:** cada tarefa lista os arquivos, o que ela usa de tarefas anteriores, o que entrega para as seguintes e os passos.
  Os passos seguem a ordem: escrever o teste → ver o teste falhar → implementar → ver o teste passar → commit.
