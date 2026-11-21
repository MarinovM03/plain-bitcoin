import { describe, expect, it } from 'vitest';
import { yearColumns } from './stack.ts';

describe('year columns', () => {
    it('puts each buy in its year, scaled by the biggest single buy', () => {
        const columns = yearColumns([
            { day: '2020-03-01', sats: 200 },
            { day: '2020-09-01', sats: 400 },
            { day: '2021-01-05', sats: 100 },
        ]);
        expect(columns.map((column) => column.year)).toEqual(['2020', '2021']);
        expect(columns[0]?.coins).toEqual([0.5, 1]);
        expect(columns[0]?.sats).toBe(600);
        expect(columns[1]?.coins).toEqual([0.25]);
    });

    it('skips empty or malformed buys', () => {
        expect(
            yearColumns([
                { day: 'x', sats: 5 },
                { day: '2020-01', sats: 0 },
            ]),
        ).toEqual([]);
        expect(yearColumns([{ day: '2022-01', sats: 10 }])[0]?.coins).toEqual([1]);
    });
});
