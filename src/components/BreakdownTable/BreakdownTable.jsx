import React from 'react';
import { fmtN, inr, rateFmt } from '../../lib/format.js';
import { displayName } from '../../lib/billing.js';
import './BreakdownTable.css';

export function BreakdownTable({ goodMeters, totals }) {
  return (
    <div className="breakdown-wrap">
      <h3 className="sect-title">Meter-wise breakdown</h3>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Meter</th>
              <th>Previous</th>
              <th>Current</th>
              <th>Units</th>
              <th>Rate (₹)</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {goodMeters.map((g, idx) => {
              const name = g.meter_name || displayName(g.m, g.i);
              const r = g.r;
              return (
                <tr key={g.m?.id || idx}>
                  <td>{name}</td>
                  <td>{fmtN(r.prev)}</td>
                  <td>{fmtN(r.cur)}</td>
                  <td>{fmtN(r.units)}</td>
                  <td>{rateFmt(r.rate).replace(' / kWh', '')}</td>
                  <td className="total">{inr(r.total)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td></td>
              <td></td>
              <td>{fmtN(totals.units)}</td>
              <td></td>
              <td>{inr(totals.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
