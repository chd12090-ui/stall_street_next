export const dailyMentalRecoveryMinute=0;
export const dailyMentalRecoveryPoints=50;
export const recoverDailyMental=mental=>Math.min(100,mental+dailyMentalRecoveryPoints);

export const spendingInterval=60_000;
export const spendingPerPoint=6;
export const spendingBase=30;
const wealthRatePerUnit=.000025;
export const spendingWealthMaxRate=wealthRatePerUnit*spendingPerPoint;
export const missingMental=mental=>100-Math.min(100,Math.max(0,Math.round(mental)));
export const spendingWealthRate=mental=>spendingWealthMaxRate*missingMental(mental)/100;
// Preserve the rounding used by the former ten-second charge.
export const spendingWealthCharge=(mental,wealth)=>spendingPerPoint*Math.round(Math.max(0,wealth)*(wealthRatePerUnit*missingMental(mental)/100));
export const spendingPerTick=(mental,wealth=0)=>spendingBase+spendingPerPoint*missingMental(mental)+spendingWealthCharge(mental,wealth);
