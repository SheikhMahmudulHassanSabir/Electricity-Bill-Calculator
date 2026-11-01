import React, { useState } from 'react';
import { MeterCard } from '../MeterCard/MeterCard.jsx';
import { Icon } from '../Icons/Icons.jsx';
import './MeterList.css';

export function MeterList({
  meters,
  evalResults,
  touched,
  submitted,
  onFieldChange,
  onFieldBlur,
  onNameBlur,
  onRemove,
  onAddMeter,
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMeterName, setNewMeterName] = useState('');
  const [newInitialReading, setNewInitialReading] = useState('');
  const [addError, setAddError] = useState('');

  const handleQuickAdd = async () => {
    await onAddMeter({
      name: `Room ${meters.length + 1}`,
      initialReading: null,
    });
  };

  const handleCustomAdd = async (e) => {
    e.preventDefault();
    setAddError('');
    const initStr = newInitialReading.trim();
    if (initStr !== '') {
      const n = Number(initStr);
      if (!Number.isFinite(n) || n < 0) {
        setAddError('Initial reading must be a valid non-negative number.');
        return;
      }
    }

    try {
      await onAddMeter({
        name: newMeterName.trim() || `Room ${meters.length + 1}`,
        initialReading: initStr === '' ? null : initStr,
      });
      setNewMeterName('');
      setNewInitialReading('');
      setShowAddForm(false);
    } catch (err) {
      setAddError(err.message || 'Could not add meter.');
    }
  };

  return (
    <section className="panel meters-panel" aria-labelledby="mTitle">
      <div className="panel-head">
        <div>
          <h2 id="mTitle">Meters</h2>
          <p>Each meter keeps its own readings and bill.</p>
        </div>
      </div>

      <div id="meterList">
        {meters.map((meter, idx) => (
          <MeterCard
            key={meter.id}
            meter={meter}
            index={idx}
            totalMeters={meters.length}
            evalResult={evalResults[idx]}
            touched={touched}
            submitted={submitted}
            onFieldChange={onFieldChange}
            onFieldBlur={onFieldBlur}
            onNameBlur={onNameBlur}
            onRemove={onRemove}
          />
        ))}
      </div>

      <div className="add-row">
        <div className="add-actions">
          <button
            className="btn"
            id="addMeter"
            type="button"
            onClick={handleQuickAdd}
          >
            <Icon name="plus" />
            <span>Add Meter</span>
          </button>
          <button
            className="btn ghost"
            type="button"
            onClick={() => {
              setShowAddForm((v) => !v);
              setAddError('');
            }}
          >
            {showAddForm ? 'Cancel custom meter' : 'Add with initial reading…'}
          </button>
        </div>

        {showAddForm && (
          <form className="custom-meter-form" onSubmit={handleCustomAdd}>
            <div className="custom-meter-grid">
              <div className="field">
                <label htmlFor="new-meter-name">Meter name</label>
                <div className="input">
                  <input
                    id="new-meter-name"
                    className="text"
                    placeholder={`e.g. Room ${meters.length + 1}`}
                    value={newMeterName}
                    onChange={(e) => setNewMeterName(e.target.value)}
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="new-meter-init">Initial reading (optional)</label>
                <div className={`input ${addError ? 'bad' : ''}`}>
                  <input
                    id="new-meter-init"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={newInitialReading}
                    onChange={(e) => setNewInitialReading(e.target.value)}
                  />
                  <span className="fix end">kWh</span>
                </div>
              </div>
              <div className="custom-meter-submit">
                <button type="submit" className="btn primary">
                  Create Meter
                </button>
              </div>
            </div>
            {addError && (
              <div className="err" role="alert">
                {addError}
              </div>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
