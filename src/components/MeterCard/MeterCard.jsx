import React from 'react';
import { Icon } from '../Icons/Icons.jsx';
import { fmtN, inr, formatDateIN } from '../../lib/format.js';
import { displayName } from '../../lib/billing.js';
import './MeterCard.css';

export function MeterCard({
  meter,
  index,
  totalMeters,
  evalResult,
  touched,
  submitted,
  onFieldChange,
  onFieldBlur,
  onNameBlur,
  onRemove,
}) {
  const showFieldError = (field) => {
    const msg = evalResult?.errors?.[field];
    if (!msg) return null;
    const isVisible = submitted || touched[`${meter.id}.${field}`];
    return isVisible ? msg : null;
  };

  const prevError = showFieldError('prev');
  const curError = showFieldError('cur');
  const nameLabel = displayName(meter, index);

  let autoFillNote = null;
  if (meter.latest_bill_date && !meter.prevEdited) {
    autoFillNote = `Auto-filled from bill dated ${formatDateIN(meter.latest_bill_date)}`;
  } else if (meter.autoFillInitial && !meter.prevEdited) {
    autoFillNote = 'Auto-filled from initial reading';
  }

  return (
    <article
      className="meter"
      data-id={meter.id}
      aria-label={`Meter ${index + 1}: ${nameLabel}`}
    >
      <div className="meter-head">
        <div className="field">
          <label htmlFor={`name-${meter.id}`}>Meter / room name</label>
          <div className="input">
            <input
              className="text"
              id={`name-${meter.id}`}
              data-field="name"
              autoComplete="off"
              placeholder="e.g. Room 1, Main Meter"
              value={meter.name}
              onChange={(e) => onFieldChange(meter.id, 'name', e.target.value)}
              onBlur={() => onNameBlur && onNameBlur(meter.id, meter.name)}
            />
          </div>
        </div>
        <button
          className="btn icon ghost"
          type="button"
          onClick={() => onRemove(meter.id)}
          aria-label={`Remove ${nameLabel}`}
          disabled={totalMeters <= 1}
        >
          <Icon name="trash" />
        </button>
      </div>

      <div className="fields-two">
        <div className="field">
          <label htmlFor={`prev-${meter.id}`}>Previous reading</label>
          <div className={`input ${prevError ? 'bad' : ''}`} data-wrap="prev">
            <input
              id={`prev-${meter.id}`}
              data-field="prev"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={meter.prev}
              onChange={(e) => onFieldChange(meter.id, 'prev', e.target.value)}
              onBlur={() => onFieldBlur(meter.id, 'prev')}
              aria-invalid={prevError ? 'true' : 'false'}
              aria-describedby={`prev-err-${meter.id}`}
            />
            <span className="fix end">kWh</span>
          </div>
          {autoFillNote && !prevError && (
            <p className="autofill-note">{autoFillNote}</p>
          )}
          <div className="err" id={`prev-err-${meter.id}`} role="alert">
            {prevError || ''}
          </div>
        </div>

        <div className="field">
          <label htmlFor={`cur-${meter.id}`}>Current reading</label>
          <div className={`input ${curError ? 'bad' : ''}`} data-wrap="cur">
            <input
              id={`cur-${meter.id}`}
              data-field="cur"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={meter.cur}
              onChange={(e) => onFieldChange(meter.id, 'cur', e.target.value)}
              onBlur={() => onFieldBlur(meter.id, 'cur')}
              aria-invalid={curError ? 'true' : 'false'}
              aria-describedby={`cur-err-${meter.id}`}
            />
            <span className="fix end">kWh</span>
          </div>
          <div className="err" id={`cur-err-${meter.id}`} role="alert">
            {curError || ''}
          </div>
        </div>
      </div>

      <div className="meter-foot">
        <span data-sum>
          {evalResult?.ok ? (
            <span className="live">{fmtN(evalResult.units)} units</span>
          ) : evalResult?.idle ? (
            'Waiting for readings'
          ) : (
            'Incomplete'
          )}
        </span>
        <span>
          Meter bill{' '}
          <strong data-total>
            {evalResult?.ok ? inr(evalResult.total) : '—'}
          </strong>
        </span>
      </div>
    </article>
  );
}
