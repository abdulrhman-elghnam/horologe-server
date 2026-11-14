/** Rounds to cents. All money maths goes through these helpers to avoid float drift. */
export const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

export const sumMoney = (values: number[]): number => roundMoney(values.reduce((total, value) => total + value, 0));

export const multiplyMoney = (price: number, quantity: number): number => roundMoney(price * quantity);
