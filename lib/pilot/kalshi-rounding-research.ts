// Simulation of published Kalshi fee-rounding mechanics, not venue validation.
// Every money value is an integer microdollar ($0.000001).
export function kalshiRoundingResearch(
  fills: { revenueMicros: number; tradeFeeMicros: number }[],
  precisionMicros: 100 | 10000,
) {
  if (![100, 10000].includes(precisionMicros) || fills.length > 100000)
    throw Error("Unsupported rounding research input");
  const grid = BigInt(precisionMicros);
  let accumulator = 0n,
    totalFee = 0n,
    totalChange = 0n;
  const rows = [];
  for (const f of fills) {
    if (
      !Number.isSafeInteger(f.revenueMicros) ||
      !Number.isSafeInteger(f.tradeFeeMicros) ||
      f.tradeFeeMicros < 0
    )
      throw Error("Invalid rounding research fill");
    const revenue = BigInt(f.revenueMicros),
      tradeFee = BigInt(f.tradeFeeMicros),
      net = revenue - tradeFee;
    const aligned = (net >= 0n ? net / grid : (net - grid + 1n) / grid) * grid;
    const rounding = net - aligned;
    accumulator += rounding;
    const available = (accumulator / grid) * grid,
      cap = ((tradeFee + rounding) / grid) * grid;
    const rebate = available < cap ? available : cap;
    accumulator -= rebate;
    const fee = tradeFee + rounding - rebate,
      change = revenue - fee;
    totalFee += fee;
    totalChange += change;
    for (const n of [accumulator, totalFee, totalChange])
      if (
        n > BigInt(Number.MAX_SAFE_INTEGER) ||
        n < BigInt(Number.MIN_SAFE_INTEGER)
      )
        throw Error("Rounding research amount out of range");
    rows.push({
      tradeFeeMicros: f.tradeFeeMicros,
      roundingMicros: Number(rounding),
      rebateMicros: Number(rebate),
      netFeeMicros: Number(fee),
      balanceChangeMicros: Number(change),
      carriedRoundingMicros: Number(accumulator),
    });
  }
  return {
    mode: "PUBLISHED_MECHANICS_SIMULATION" as const,
    moneyScale: 1000000 as const,
    precisionMicros,
    feeMicros: Number(totalFee),
    balanceChangeMicros: Number(totalChange),
    carriedRoundingMicros: Number(accumulator),
    rows,
    venueValidated: false as const,
  };
}
