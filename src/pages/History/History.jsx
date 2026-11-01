import React, { useState, useMemo, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { useBills } from '../../hooks/useBills.js';
import { ViewToggle } from '../../components/ViewToggle/ViewToggle.jsx';
import { IndividualBills } from '../../components/IndividualBills/IndividualBills.jsx';
import { CombinedBill } from '../../components/CombinedBill/CombinedBill.jsx';
import { Icon } from '../../components/Icons/Icons.jsx';
import {
  fmtN,
  inr,
  rateFmt,
  formatDateIN,
  formatLongDateIN,
} from '../../lib/format.js';
import { generateBillPdf } from '../../lib/pdf.js';
import './History.css';

export function History({ onToast }) {
  const { workspaces, activeWorkspace, activeWorkspaceId, loadingWorkspaces } =
    useWorkspace();
  const { bills, loadingBills, deleteBill } = useBills(activeWorkspaceId);

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedBillId, setSelectedBillId] = useState(null);
  const [detailView, setDetailView] = useState('combined');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const handleAfterPrint = () => {
      document.body.removeAttribute('data-print');
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      if (fromDate && b.bill_date < fromDate) return false;
      if (toDate && b.bill_date > toDate) return false;
      return true;
    });
  }, [bills, fromDate, toDate]);

  const selectedBill = useMemo(
    () => bills.find((b) => b.id === selectedBillId) || null,
    [bills, selectedBillId]
  );

  // Convert selectedBill items into IndividualBills / CombinedBill structure
  const selectedBillComputed = useMemo(() => {
    if (!selectedBill) return null;
    const rate = Number(selectedBill.rate_per_unit);
    const items = selectedBill.items || [];

    const meters = items.map((item, idx) => ({
      id: item.id || idx,
      name: item.meter_name,
      meter_name: item.meter_name,
    }));

    const evalResults = items.map((item) => ({
      ok: true,
      idle: false,
      errors: {},
      prev: Number(item.previous_reading),
      cur: Number(item.current_reading),
      units: Number(item.units),
      rate,
      amount: Number(item.amount),
      total: Number(item.amount),
    }));

    const goodMeters = items.map((item, idx) => ({
      m: meters[idx],
      i: idx,
      meter_name: item.meter_name,
      r: evalResults[idx],
    }));

    const totals = {
      count: items.length,
      units: Number(selectedBill.total_units),
      rate,
      charge: Number(selectedBill.total_amount),
      total: Number(selectedBill.total_amount),
    };

    return {
      meters,
      evalResults,
      goodMeters,
      totals,
    };
  }, [selectedBill]);

  if (loadingWorkspaces) {
    return (
      <div className="panel empty" role="status">
        <b>Loading workspace…</b>
      </div>
    );
  }

  if (workspaces.length === 0 || !activeWorkspace) {
    return <Navigate to="/workspaces" replace />;
  }

  const handleConfirmDelete = async (billId) => {
    setDeleting(true);
    try {
      await deleteBill(billId);
      if (selectedBillId === billId) {
        setSelectedBillId(null);
      }
      setConfirmDeleteId(null);
      if (onToast) onToast('Saved bill deleted.');
    } catch (err) {
      if (onToast) onToast(err.message || 'Could not delete bill.', true);
    } finally {
      setDeleting(false);
    }
  };

  const handlePrintSelected = () => {
    if (!selectedBill) return;
    document.body.setAttribute('data-print', detailView);
    window.print();
  };

  const handlePdfSelected = () => {
    if (!selectedBill || !selectedBillComputed) return;
    generateBillPdf({
      mode: detailView,
      billDate: selectedBill.bill_date,
      workspaceName: activeWorkspace.name,
      savedByName: selectedBill.created_by_name,
      goodMeters: selectedBillComputed.goodMeters,
      totals: selectedBillComputed.totals,
    });
    if (onToast) onToast('PDF downloaded.');
  };

  return (
    <main className="history-page">
      <div className="history-header no-print">
        <div>
          <h1>Bill History — {activeWorkspace.name}</h1>
          <p>
            Every saved bill keeps the exact meter names, readings, and per-unit
            rate it was created with.
          </p>
        </div>
      </div>

      {/* Date Range Filter */}
      <section className="panel history-filters no-print" aria-label="Filter bills by date">
        <div className="filter-fields">
          <div className="field">
            <label htmlFor="filter-from">From date</label>
            <div className="input">
              <input
                id="filter-from"
                type="date"
                className="text"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="filter-to">To date</label>
            <div className="input">
              <input
                id="filter-to"
                type="date"
                className="text"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>

          {(fromDate || toDate) && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setFromDate('');
                setToDate('');
              }}
            >
              Clear filter
            </button>
          )}
        </div>
      </section>

      {/* Saved Bills Table */}
      <section className="panel no-print" aria-labelledby="saved-bills-heading">
        <div className="panel-head">
          <div>
            <h2 id="saved-bills-heading">Saved bills</h2>
            <p>
              {filteredBills.length}{' '}
              {filteredBills.length === 1 ? 'bill' : 'bills'} found
            </p>
          </div>
        </div>

        {loadingBills ? (
          <div className="empty" role="status">
            <b>Loading bill history…</b>
          </div>
        ) : filteredBills.length === 0 ? (
          <div className="empty">
            <Icon name="history" />
            <b>No saved bills found</b>
            {bills.length === 0
              ? 'Calculate and save a bill from the Calculator page to see it here.'
              : 'No bills match the selected date range.'}
          </div>
        ) : (
          <div className="table-scroll history-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Bill date</th>
                  <th>Meters</th>
                  <th>Rate</th>
                  <th>Total units</th>
                  <th>Total amount</th>
                  <th>Saved by</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.map((bill) => {
                  const isSelected = bill.id === selectedBillId;
                  const isConfirming = bill.id === confirmDeleteId;
                  return (
                    <tr
                      key={bill.id}
                      className={isSelected ? 'selected-row' : ''}
                    >
                      <td>{formatDateIN(bill.bill_date)}</td>
                      <td>{bill.items?.length || 0}</td>
                      <td>{rateFmt(bill.rate_per_unit)}</td>
                      <td>{fmtN(bill.total_units)} kWh</td>
                      <td className="total">{inr(bill.total_amount)}</td>
                      <td className="saved-by-cell">
                        Saved by {bill.created_by_name}
                      </td>
                      <td className="actions-cell">
                        {isConfirming ? (
                          <div className="inline-confirm" role="group" aria-label="Confirm delete bill">
                            <span className="confirm-label">Delete this bill?</span>
                            <button
                              type="button"
                              className="btn danger btn-sm"
                              onClick={() => handleConfirmDelete(bill.id)}
                              disabled={deleting}
                            >
                              {deleting ? 'Deleting…' : 'Confirm delete'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => setConfirmDeleteId(null)}
                              disabled={deleting}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="row-btns">
                            <button
                              type="button"
                              className={`btn btn-sm ${isSelected ? 'primary' : ''}`}
                              onClick={() =>
                                setSelectedBillId(isSelected ? null : bill.id)
                              }
                            >
                              <Icon name="eye" />
                              <span>{isSelected ? 'Viewing' : 'View bill'}</span>
                            </button>
                            <button
                              type="button"
                              className="btn icon ghost btn-sm"
                              onClick={() => setConfirmDeleteId(bill.id)}
                              aria-label={`Delete bill dated ${formatDateIN(bill.bill_date)}`}
                            >
                              <Icon name="trash" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Selected Bill Detail View */}
      {selectedBill && selectedBillComputed && (
        <section className="history-detail-section" aria-label="Selected bill details">
          <div className="panel detail-banner no-print">
            <div>
              <h2>Bill dated {formatLongDateIN(selectedBill.bill_date)}</h2>
              <p>
                Saved by <strong>{selectedBill.created_by_name}</strong> · Rate
                locked at <strong>{rateFmt(selectedBill.rate_per_unit)}</strong>
              </p>
            </div>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setSelectedBillId(null)}
            >
              <Icon name="close" />
              <span>Close detail</span>
            </button>
          </div>

          <ViewToggle
            view={detailView}
            onChangeView={setDetailView}
            onPrint={handlePrintSelected}
            onDownloadPdf={handlePdfSelected}
          />

          <div id="results">
            <div className="print-head">
              <h2 id="printTitle">
                {detailView === 'individual'
                  ? 'Electricity Bills'
                  : 'Combined Electricity Bill'}
              </h2>
              <span id="printDate">
                Workspace: {activeWorkspace.name} · Bill Date:{' '}
                {formatLongDateIN(selectedBill.bill_date)} · Saved by{' '}
                {selectedBill.created_by_name}
              </span>
            </div>

            <div
              id="viewIndividual"
              className={detailView !== 'individual' ? 'view-off' : ''}
            >
              <IndividualBills
                meters={selectedBillComputed.meters}
                evalResults={selectedBillComputed.evalResults}
                goodCount={selectedBillComputed.goodMeters.length}
              />
            </div>

            <div
              id="viewCombined"
              className={detailView !== 'combined' ? 'view-off' : ''}
            >
              <CombinedBill
                goodMeters={selectedBillComputed.goodMeters}
                totals={selectedBillComputed.totals}
                totalMetersCount={selectedBillComputed.meters.length}
              />
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
