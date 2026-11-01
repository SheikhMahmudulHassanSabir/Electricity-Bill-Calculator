import React from 'react';
import './BillingRate.css';

export function BillingRate({
  rate,
  onRateChange,
  onRateBlur,
  rateError,
  showError,
  savingRate,
}) {
  return (
    <section className="panel" id="rateCard" aria-labelledby="rTitle">
      <div className="panel-head">
        <div>
          <h2 id="rTitle">Billing rate</h2>
          <p>Price for one unit (kWh).</p>
        </div>
      </div>
      <div className="panel-body">
        <div className="field">
          <label htmlFor="rate">Per unit rate</label>
          <div className={`input ${showError && rateError ? 'bad' : ''}`} id="rateWrap">
            <span className="fix">₹</span>
            <input
              id="rate"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={rate}
              onChange={(e) => onRateChange(e.target.value)}
              onBlur={onRateBlur}
              aria-invalid={showError && rateError ? 'true' : 'false'}
              aria-describedby="rateErr"
            />
            <span className="fix end">/ kWh</span>
          </div>
          <div className="err" id="rateErr" role="alert">
            {showError && rateError ? rateError : ''}
          </div>
        </div>
        <p className="hint">
          Shared across this workspace. Changes apply to new or unsaved bills; saved bills keep their original rate.
          {savingRate ? ' Saving…' : ''}
        </p>
      </div>
    </section>
  );
}
