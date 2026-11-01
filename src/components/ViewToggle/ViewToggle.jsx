import React from 'react';
import { Icon } from '../Icons/Icons.jsx';
import './ViewToggle.css';

export function ViewToggle({
  view,
  onChangeView,
  onPrint,
  onDownloadPdf,
}) {
  return (
    <div className="viewbar no-print">
      <div className="seg" role="group" aria-label="Bill view">
        <button
          type="button"
          id="tabInd"
          aria-pressed={view === 'individual'}
          onClick={() => onChangeView('individual')}
        >
          <Icon name="grid" />
          <span>Individual Bills</span>
        </button>
        <button
          type="button"
          id="tabCom"
          aria-pressed={view === 'combined'}
          onClick={() => onChangeView('combined')}
        >
          <Icon name="layers" />
          <span>Combined Bill</span>
        </button>
      </div>
      <div className="actions">
        <button className="btn" id="printBtn" type="button" onClick={onPrint}>
          <Icon name="print" />
          <span id="printLabel">
            {view === 'individual' ? 'Print bills' : 'Print combined bill'}
          </span>
        </button>
        <button
          className="btn dark"
          id="pdfBtn"
          type="button"
          onClick={onDownloadPdf}
        >
          <Icon name="download" />
          <span>Download PDF</span>
        </button>
      </div>
    </div>
  );
}
