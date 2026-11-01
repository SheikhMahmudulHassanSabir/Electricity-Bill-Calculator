import React from 'react';
import { Icon } from '../Icons/Icons.jsx';
import { BreakdownTable } from '../BreakdownTable/BreakdownTable.jsx';
import { fmtN, inr } from '../../lib/format.js';
import './CombinedBill.css';

export function CombinedBill({ goodMeters, totals, totalMetersCount }) {
  if (!totals || totals.count === 0) {
    return (
      <div className="panel empty">
        <Icon name="layers" />
        <b>No combined bill yet</b>
        Add at least one meter with valid readings and a rate.
      </div>
    );
  }

  const skipped = Math.max(0, (totalMetersCount || 0) - totals.count);

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>Combined bill</h2>
          <p>Sum of all individual meter bills.</p>
        </div>
      </div>

      <div className="tiles">
        <div className="tile">
          <small>Meters</small>
          <b>{totals.count}</b>
        </div>
        <div className="tile">
          <small>Total units</small>
          <b>{fmtN(totals.units)} kWh</b>
        </div>
        <div className="tile">
          <small>Total charges</small>
          <b>{inr(totals.total)}</b>
        </div>
      </div>

      <div className="grand">
        <span>Grand total payable</span>
        <strong>{inr(totals.total)}</strong>
      </div>

      <BreakdownTable goodMeters={goodMeters} totals={totals} />

      {skipped > 0 && (
        <p className="note">
          {skipped} of {totalMetersCount} meters left out because their readings
          are incomplete or invalid.
        </p>
      )}
    </div>
  );
}
