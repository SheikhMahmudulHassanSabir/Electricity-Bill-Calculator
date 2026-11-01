import React, { useState, useEffect, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { useMeters } from '../../hooks/useMeters.js';
import { useBills } from '../../hooks/useBills.js';
import { BillingRate } from '../../components/BillingRate/BillingRate.jsx';
import { MeterList } from '../../components/MeterList/MeterList.jsx';
import { ViewToggle } from '../../components/ViewToggle/ViewToggle.jsx';
import { IndividualBills } from '../../components/IndividualBills/IndividualBills.jsx';
import { CombinedBill } from '../../components/CombinedBill/CombinedBill.jsx';
import { Icon } from '../../components/Icons/Icons.jsx';
import {
  computeBills,
  displayName,
  isBillDateEarlierThanLatest,
  parseNum,
  validateRate,
} from '../../lib/billing.js';
import {
  fmtN,
  inr,
  formatDateIN,
  formatLongDateIN,
  todayIsoDate,
} from '../../lib/format.js';
import { generateBillPdf } from '../../lib/pdf.js';
import './Calculator.css';

export function Calculator({ onToast }) {
  const { user } = useAuth();
  const {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    loadingWorkspaces,
    saveWorkspaceRate,
  } = useWorkspace();

  const {
    meters,
    loadingMeters,
    addMeter,
    updateLocalMeterField,
    persistMeterName,
    removeMeter,
    resetCalculatorReadings,
    applySavedBillReadings,
  } = useMeters(activeWorkspaceId);

  const { latestBillDate, saveBill } = useBills(activeWorkspaceId);

  const [rate, setRate] = useState('');
  const [savingRate, setSavingRate] = useState(false);
  const [billDate, setBillDate] = useState(() => todayIsoDate());
  const [view, setView] = useState('individual');
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [savingBill, setSavingBill] = useState(false);

  // Sync workspace billing rate when switching workspaces or receiving realtime update
  useEffect(() => {
    if (!activeWorkspace) {
      setRate('');
      return;
    }
    const dbRate = activeWorkspace.rate_per_unit;
    setRate(dbRate !== null && dbRate !== undefined ? String(dbRate) : '');
    setTouched({});
    setSubmitted(false);
  }, [activeWorkspace?.id, activeWorkspace?.rate_per_unit]);

  // Clean up print attribute after printing
  useEffect(() => {
    const handleAfterPrint = () => {
      document.body.removeAttribute('data-print');
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const computed = useMemo(() => computeBills(meters, rate), [meters, rate]);

  const dateWarning = useMemo(
    () => isBillDateEarlierThanLatest(billDate, latestBillDate),
    [billDate, latestBillDate]
  );

  if (loadingWorkspaces) {
    return (
      <div className="panel empty" role="status">
        <b>Loading workspace…</b>
        Preparing your meters and billing rate.
      </div>
    );
  }

  if (workspaces.length === 0 || !activeWorkspace) {
    return <Navigate to="/workspaces" replace />;
  }

  const handleRateChange = (nextVal) => {
    setRate(nextVal);
  };

  const handleRateBlur = async () => {
    setTouched((prev) => ({ ...prev, rate: true }));
    const err = validateRate(rate);
    if (err && rate.trim() !== '') return;

    setSavingRate(true);
    try {
      const parsed = parseNum(rate);
      await saveWorkspaceRate(parsed.empty ? null : parsed.v);
    } catch (e) {
      if (onToast) onToast(e.message || 'Could not save billing rate.', true);
    } finally {
      setSavingRate(false);
    }
  };

  const handleMeterFieldChange = (meterId, field, value) => {
    updateLocalMeterField(meterId, field, value);
  };

  const handleMeterFieldBlur = (meterId, field) => {
    setTouched((prev) => ({ ...prev, [`${meterId}.${field}`]: true }));
  };

  const handleMeterNameBlur = async (meterId, name) => {
    try {
      await persistMeterName(meterId, name);
    } catch {
      // Ignore transient rename errors
    }
  };

  const handleAddMeter = async (opts) => {
    const created = await addMeter(opts);
    if (created && onToast) {
      onToast(`${created.name} added.`);
    }
  };

  const handleRemoveMeter = async (meterId) => {
    const removed = await removeMeter(meterId);
    if (removed && onToast) {
      onToast(`${removed.name?.trim() || 'Meter'} removed.`);
    }
  };

  const handleCalculate = () => {
    setSubmitted(true);
    const ok = computed.canSave;
    if (onToast) {
      onToast(
        ok ? 'Bill calculated.' : 'Some fields need attention.',
        !ok
      );
    }
    if (ok) {
      const el = document.getElementById('results');
      if (el) {
        el.scrollIntoView({
          block: 'start',
          behavior: window.matchMedia('(prefers-reduced-motion:reduce)').matches
            ? 'auto'
            : 'smooth',
        });
      }
    }
  };

  const handleSaveBill = async () => {
    setSubmitted(true);
    if (!computed.canSave) {
      if (onToast) {
        onToast(
          'Cannot save bill until all meter readings and the billing rate are valid.',
          true
        );
      }
      return;
    }

    setSavingBill(true);
    try {
      // Persist current billing rate to workspace as well
      await saveWorkspaceRate(computed.totals.rate);

      const items = computed.good.map((g) => ({
        meter_id: g.m.id,
        meter_name: displayName(g.m, g.i),
        previous_reading: g.r.prev,
        current_reading: g.r.cur,
        units: g.r.units,
        amount: g.r.total,
      }));

      await saveBill({
        billDate,
        ratePerUnit: computed.totals.rate,
        totalUnits: computed.totals.units,
        totalAmount: computed.totals.total,
        userId: user.id,
        userName: user.full_name,
        items,
      });

      // Advance each meter's previous reading to this bill's current reading
      applySavedBillReadings(billDate, items);
      setSubmitted(false);
      setTouched({});

      if (onToast) {
        onToast('Bill saved to history. Previous readings updated for the next cycle.');
      }
    } catch (err) {
      if (onToast) {
        onToast(err.message || 'Could not save bill.', true);
      }
    } finally {
      setSavingBill(false);
    }
  };

  const handleReset = () => {
    resetCalculatorReadings();
    setTouched({});
    setSubmitted(false);
    if (onToast) onToast('Current readings cleared.');
  };

  const ensureBillable = () => {
    if (computed.good.length === 0) {
      if (onToast) {
        onToast(
          'Nothing to export yet. Enter valid readings and a rate first.',
          true
        );
      }
      return false;
    }
    return true;
  };

  const handlePrint = () => {
    if (!ensureBillable()) return;
    document.body.setAttribute('data-print', view);
    window.print();
  };

  const handleDownloadPdf = () => {
    if (!ensureBillable()) return;
    generateBillPdf({
      mode: view,
      billDate,
      workspaceName: activeWorkspace.name,
      savedByName: user?.full_name || '',
      goodMeters: computed.good,
      totals: computed.totals,
    });
    if (onToast) onToast('PDF downloaded.');
  };

  const badMetersCount = meters.length - computed.good.length;
  const showRateError = Boolean(
    computed.rateError && (submitted || touched.rate)
  );

  return (
    <main className="calculator-page">
      <div className="calc-subheader no-print">
        <div>
          <h1>{activeWorkspace.name}</h1>
          <p>
            Turn meter readings into a bill for each room, or one combined bill.
          </p>
        </div>
        <div className="stamp">{formatLongDateIN(billDate)}</div>
      </div>

      {loadingMeters ? (
        <div className="panel empty" role="status">
          <b>Loading meters…</b>
        </div>
      ) : (
        <>
          <div className="layout no-print">
            <MeterList
              meters={meters}
              evalResults={computed.res}
              touched={touched}
              submitted={submitted}
              onFieldChange={handleMeterFieldChange}
              onFieldBlur={handleMeterFieldBlur}
              onNameBlur={handleMeterNameBlur}
              onRemove={handleRemoveMeter}
              onAddMeter={handleAddMeter}
            />

            <BillingRate
              rate={rate}
              onRateChange={handleRateChange}
              onRateBlur={handleRateBlur}
              rateError={computed.rateError}
              showError={showRateError}
              savingRate={savingRate}
            />
          </div>

          {/* Calculation & Save Controls */}
          <section
            className="panel controls no-print"
            aria-label="Calculation controls"
          >
            <div className="bill-date-field">
              <label htmlFor="bill-date-input">Bill date</label>
              <div className="input">
                <input
                  id="bill-date-input"
                  type="date"
                  className="text"
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
                />
              </div>
            </div>

            <div className="control-buttons">
              <button
                className="btn primary"
                id="calcBtn"
                type="button"
                onClick={handleCalculate}
              >
                <Icon name="calc" />
                <span>Calculate Bill</span>
              </button>

              <button
                className="btn dark"
                id="saveBillBtn"
                type="button"
                onClick={handleSaveBill}
                disabled={!computed.canSave || savingBill}
              >
                <Icon name="save" />
                <span>{savingBill ? 'Saving…' : 'Save bill'}</span>
              </button>

              <button
                className="btn"
                id="resetBtn"
                type="button"
                onClick={handleReset}
              >
                <Icon name="reset" />
                <span>Reset</span>
              </button>
            </div>

            <div className="grow">
              {dateWarning && (
                <div className="banner warn" role="status" aria-live="polite">
                  <Icon name="alert" />
                  <span>
                    Selected bill date ({formatDateIN(billDate)}) is earlier than
                    the latest saved bill ({formatDateIN(latestBillDate)}).
                  </span>
                </div>
              )}

              {submitted && (
                <div
                  className={`banner ${badMetersCount === 0 && !computed.rateError ? 'ok' : 'bad'}`}
                  id="banner"
                  role="status"
                  aria-live="polite"
                >
                  <Icon
                    name={
                      badMetersCount === 0 && !computed.rateError
                        ? 'check'
                        : 'alert'
                    }
                  />
                  {badMetersCount === 0 && !computed.rateError ? (
                    <span>
                      Bill calculated for {computed.good.length}{' '}
                      {computed.good.length === 1 ? 'meter' : 'meters'}. Total
                      payable {inr(computed.totals.total)}.
                    </span>
                  ) : (
                    <span>
                      {badMetersCount}{' '}
                      {badMetersCount === 1 ? 'meter needs' : 'meters need'}{' '}
                      attention
                      {computed.rateError
                        ? ' and the billing rate is missing or invalid'
                        : ''}
                      . Fix the highlighted fields.
                    </span>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* View Selector */}
          <ViewToggle
            view={view}
            onChangeView={setView}
            onPrint={handlePrint}
            onDownloadPdf={handleDownloadPdf}
          />

          {/* Results Dashboard & Breakdown */}
          <section id="results" aria-label="Bills">
            <div className="print-head">
              <h2 id="printTitle">
                {view === 'individual'
                  ? 'Electricity Bills'
                  : 'Combined Electricity Bill'}
              </h2>
              <span id="printDate">
                Workspace: {activeWorkspace.name} · Date: {formatLongDateIN(billDate)}
              </span>
            </div>

            <div
              id="viewIndividual"
              className={view !== 'individual' ? 'view-off' : ''}
            >
              <IndividualBills
                meters={meters}
                evalResults={computed.res}
                goodCount={computed.good.length}
              />
            </div>

            <div
              id="viewCombined"
              className={view !== 'combined' ? 'view-off' : ''}
            >
              <CombinedBill
                goodMeters={computed.good}
                totals={computed.totals}
                totalMetersCount={meters.length}
              />
            </div>
          </section>

          {/* Footer Summary */}
          <footer className="panel foot no-print">
            <h2>Calculation summary</h2>
            <p>
              <code>Units = Current − Previous</code> &nbsp;{' '}
              <code>Total = Units × Rate</code>
            </p>
            <p className="sum" id="footSum">
              {computed.totals.count > 0
                ? `${computed.totals.count} of ${meters.length} meters billed · ${fmtN(
                    computed.totals.units
                  )} units · Grand total ${inr(computed.totals.total)}`
                : 'No valid meter readings yet.'}
            </p>
          </footer>
        </>
      )}
    </main>
  );
}
