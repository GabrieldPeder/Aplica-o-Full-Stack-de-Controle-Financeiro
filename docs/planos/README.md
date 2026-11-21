# Planos de implementação

Cada PR do projeto tem um plano próprio, escrito antes de começar a implementação.
O plano é do **responsável pelo PR**: ele implementa todas as tarefas do plano, e o outro integrante revisa o PR antes do merge.

O plano de um PR só é escrito quando o PR vai começar, porque depende do que os PRs anteriores entregaram.

| PR | Assunto | Responsável | Revisor | Plano | Situação |
|---|---|---|---|---|---|
| 0 | Fundação | Gabriel | João Vitor | [pr0-fundacao.md](pr0-fundacao.md) | Concluído (#2) |
| 1 | Autenticação | Gabriel | João Vitor | [pr1-autenticacao.md](pr1-autenticacao.md) | Concluído (#5) |
| 2 | Categorias + fontes/destinos | Gabriel | João Vitor | [pr2-categorias-fontes.md](pr2-categorias-fontes.md) | Concluído (#6; entregue pelo #7) |
| 3 | Lançamentos e parcelamento | João Vitor | Gabriel | [pr3-lancamentos.md](pr3-lancamentos.md) | Concluído (#4 e #10) |
| 4 | Seed de demonstração | João Vitor | Gabriel | [pr4-seed.md](pr4-seed.md) | Concluído (#11; entregue pelo #13) |
| 5 | Relatório por categoria + Dashboard | João Vitor | Gabriel | [pr5-relatorio-categorias.md](pr5-relatorio-categorias.md) | Concluído (#12; entregue pelo #13) |
| 6 | Relatório por fonte/destino + Faturas | Gabriel | João Vitor | [pr6-relatorios-faturas.md](pr6-relatorios-faturas.md) | Concluído (#8) |
| 7 | Saúde financeira (desafio) | João Vitor | Gabriel | [pr7-saude-financeira.md](pr7-saude-financeira.md) | Concluído (#9; entregue pelo #13) |
| 8 | Acabamento e ensaio da apresentação | Ambos | — | [checklist-final.md](../checklist-final.md) | Em andamento |

## Como um plano é organizado

- **Objetivo:** o que o PR entrega, em uma frase.
- **Regras gerais:** restrições que valem para todas as tarefas (pastas permitidas, bibliotecas, padrão de erro).
- **Casos de atenção:** situações fáceis de esquecer e que precisam de teste.
- **Tarefas:** cada tarefa lista os arquivos, o que ela usa de tarefas anteriores, o que entrega para as seguintes e os passos.
  Os passos seguem a ordem: escrever o teste → ver o teste falhar → implementar → ver o teste passar → commit.
