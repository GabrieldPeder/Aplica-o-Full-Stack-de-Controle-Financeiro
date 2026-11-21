import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularFatura, ultimoDiaDoMes, dataValida, hojeIso } from '../../src/config/datas.js';

const nubank = { diaFechamento: 3, diaVencimento: 10 };
const visa = { diaFechamento: 25, diaVencimento: 5 };

test('tabela de exemplos do enunciado', () => {
  assert.deepEqual(calcularFatura('2026-11-02', nubank, 1), {
    referencia: '2026-11', fechamento: '2026-11-03', vencimento: '2026-11-10',
  });
  assert.deepEqual(calcularFatura('2026-11-03', nubank, 1), {
    referencia: '2026-12', fechamento: '2026-12-03', vencimento: '2026-12-10',
  });
  assert.deepEqual(calcularFatura('2026-12-28', visa, 1), {
    referencia: '2027-02', fechamento: '2027-01-25', vencimento: '2027-02-05',
  });
  assert.deepEqual(calcularFatura('2026-12-20', visa, 3), {
    referencia: '2027-03', fechamento: '2027-02-25', vencimento: '2027-03-05',
  });
});

test('fechamento no dia 31 em fevereiro vira o último dia do mês', () => {
  assert.deepEqual(calcularFatura('2027-02-15', { diaFechamento: 31, diaVencimento: 10 }, 1), {
    referencia: '2027-03', fechamento: '2027-02-28', vencimento: '2027-03-10',
  });
});

test('compra no último dia de fevereiro com fechamento 31 já conta como dia do fechamento', () => {
  assert.equal(calcularFatura('2027-02-28', { diaFechamento: 31, diaVencimento: 10 }, 1).fechamento, '2027-03-31');
});

test('vencimento no dia 31 em mês de 30 dias', () => {
  assert.equal(calcularFatura('2026-11-02', { diaFechamento: 5, diaVencimento: 31 }, 1).vencimento, '2026-11-30');
});

test('parcela 12 atravessa o ano', () => {
  assert.deepEqual(calcularFatura('2026-11-02', nubank, 12), {
    referencia: '2027-10', fechamento: '2027-10-03', vencimento: '2027-10-10',
  });
});

test('ultimoDiaDoMes considera ano bissexto (mês de 0 a 11)', () => {
  assert.equal(ultimoDiaDoMes(2028, 1), 29);
  assert.equal(ultimoDiaDoMes(2027, 1), 28);
  assert.equal(ultimoDiaDoMes(2026, 10), 30);
});

test('dataValida aceita só AAAA-MM-DD existente', () => {
  assert.equal(dataValida('2026-11-03'), true);
  assert.equal(dataValida('2028-02-29'), true);
  for (const invalida of ['2026-02-30', '2026-13-01', '2026-00-10', '26-1-1', '2026-1-1', '03/11/2026', '', undefined]) {
    assert.equal(dataValida(invalida), false, String(invalida));
  }
});

test('hojeIso devolve a data no formato AAAA-MM-DD', () => {
  assert.match(hojeIso(), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(hojeIso(new Date('2026-11-18T23:30:00-03:00')), '2026-11-18');
});

test('inicioDoMes e fimDoMes', async () => {
  const { inicioDoMes, fimDoMes } = await import('../../src/config/datas.js');
  assert.equal(inicioDoMes('2026-11-21'), '2026-11-01');
  assert.equal(fimDoMes('2026-11-21'), '2026-11-30');
  assert.equal(fimDoMes('2028-02-10'), '2028-02-29');
  assert.equal(fimDoMes('2026-12-31'), '2026-12-31');
});
