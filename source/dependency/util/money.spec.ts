import { multiplyMoney, roundMoney, sumMoney } from './money.js';

describe('money helpers', () => {
  it('rounds to cents without float drift', () => {
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
    expect(roundMoney(1.005)).toBe(1.01);
    expect(multiplyMoney(19.99, 3)).toBe(59.97);
  });
});
