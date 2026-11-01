import React from 'react';
import { Icon } from '../Icons/Icons.jsx';
import { fmtN, inr, rateFmt } from '../../lib/format.js';
import { displayName } from '../../lib/billing.js';
import './IndividualBills.css';

export function IndividualBills({ meters, evalResults, goodCount }) {
  if (!meters || meters.length === 0) {
    return null;
  }

  const allIdle =
    goodCount === 0 &&
    meters.every((_, i) => evalResults[i]?.idle);

  if (allIdle) {
    return (
      <div className="panel empty">
        <Icon name="gauge" />
        <b>No bills yet</b>
        Enter meter readings and a rate. Bills appear here as you type.
      </div>
    );
  }

  return (
    <div className="bill-grid">
      {meters.map((meter, idx) => {
        const r = evalResults[idx];
        const name = meter.meter_name || displayName(meter, idx);

        if (!r || !r.ok) {
          const firstError = r?.errors
            ? Object.values(r.errors)[0]
            : null;
          return (
            <article key={meter.id || idx} className="panel bill waiting">
              <div className="bill-top">
                <h3>{name}</h3>
                <span className="tag">Not billed</span>
              </div>
              <div className="waiting-body">
                {r?.idle
                  ? 'Enter the previous and current readings to see this bill.'
                  : firstError || 'Complete the highlighted fields.'}
              </div>
            </article>
          );
        }

        return (
          <article key={meter.id || idx} className="panel bill">
            <div className="bill-top">
              <h3>{name}</h3>
              <span className="tag">Meter bill</span>
            </div>

            <div className="dial">
              <div>
                <small>Previous</small>
                <b>{fmtN(r.prev)}</b>
              </div>
              <Icon name="arrow" />
              <div style={{ textAlign: 'right' }}>
                <small>Current</small>
                <b>{fmtN(r.cur)}</b>
              </div>
            </div>

            <dl className="rows">
              <div>
                <dt>Units consumed</dt>
                <dd>{fmtN(r.units)} kWh</dd>
              </div>
              <div>
                <dt>Rate per unit</dt>
                <dd>{rateFmt(r.rate)}</dd>
              </div>
              <div>
                <dt>Electricity charges</dt>
                <dd>{inr(r.total)}</dd>
              </div>
            </dl>

            <div className="pay">
              <span>Amount payable</span>
              <strong>{inr(r.total)}</strong>
            </div>
          </article>
        );
      })}
    </div>
  );
}
