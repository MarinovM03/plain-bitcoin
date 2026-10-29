import type { PowerData } from '../model/power.ts';
import type { Fiat } from '../util/format.ts';
import ukCpi from './cpi/uk.json';
import usCpi from './cpi/us.json';
import gbpPrices from './prices/gbp.json';
import usdPrices from './prices/usd.json';

export interface MonthlySeries {
    series: string;
    source: string;
    url: string;
    licence: string;
    asOf: string;
    months: Record<string, number>;
}

export interface PowerSeries {
    cpi: MonthlySeries;
    prices: MonthlySeries;
}

export const POWER_SERIES: Record<Fiat, PowerSeries> = {
    GBP: { cpi: ukCpi, prices: gbpPrices },
    USD: { cpi: usCpi, prices: usdPrices },
};

export function powerData(currency: Fiat): PowerData {
    const { cpi, prices } = POWER_SERIES[currency];
    return { cpi: cpi.months, closes: prices.months };
}
