import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fmtN, pdfMoney, formatLongDateIN, todayIsoDate } from './format.js';
import { displayName } from './billing.js';

/**
 * Generates and downloads an A4 PDF for either 'individual' or 'combined' view.
 * Uses "Rs." because default PDF Helvetica font has no ₹ symbol.
 * Contains no additional charges anywhere (Total = Units * Rate).
 */
export function generateBillPdf({
  mode = 'individual',
  billDate = todayIsoDate(),
  workspaceName = '',
  savedByName = '',
  goodMeters = [],
  totals = { count: 0, units: 0, charge: 0, total: 0 },
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const L = 40;
  const R = 40;
  const ink = [20, 25, 24];
  const green = [14, 138, 78];

  const title =
    mode === 'individual' ? 'Electricity Bills' : 'Combined Electricity Bill';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(ink[0], ink[1], ink[2]);
  doc.text(title, L, 52);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90, 98, 95);

  const metaParts = [`Date: ${formatLongDateIN(billDate)}`];
  if (workspaceName) metaParts.push(`Workspace: ${workspaceName}`);
  if (savedByName) metaParts.push(`Saved by: ${savedByName}`);
  doc.text(metaParts.join('   |   '), L, 70);

  let y = 90;

  if (mode === 'individual') {
    goodMeters.forEach((g) => {
      const r = g.r;
      const name = g.meter_name || displayName(g.m, g.i);
      autoTable(doc, {
        startY: y,
        margin: { left: L, right: R },
        theme: 'grid',
        head: [[name, '']],
        body: [
          ['Previous reading', `${fmtN(r.prev)} kWh`],
          ['Current reading', `${fmtN(r.cur)} kWh`],
          ['Units consumed', `${fmtN(r.units)} kWh`],
          ['Rate per unit', `Rs. ${fmtN(r.rate, 4)} / kWh`],
          [
            {
              content: 'Amount payable',
              styles: { fontStyle: 'bold', textColor: green },
            },
            {
              content: pdfMoney(r.total),
              styles: { fontStyle: 'bold', textColor: green },
            },
          ],
        ],
        headStyles: { fillColor: ink, textColor: 255 },
        columnStyles: { 1: { halign: 'right' } },
        styles: { fontSize: 10, cellPadding: 6 },
      });
      y = doc.lastAutoTable.finalY + 18;
    });
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: L, right: R },
      theme: 'grid',
      head: [['Summary', '']],
      body: [
        ['Total meters', String(totals.count)],
        ['Total units consumed', `${fmtN(totals.units)} kWh`],
        ['Total electricity charges', pdfMoney(totals.total)],
        [
          {
            content: 'Grand total payable',
            styles: { fontStyle: 'bold', textColor: green },
          },
          {
            content: pdfMoney(totals.total),
            styles: { fontStyle: 'bold', textColor: green },
          },
        ],
      ],
      headStyles: { fillColor: ink, textColor: 255 },
      columnStyles: { 1: { halign: 'right' } },
      styles: { fontSize: 10, cellPadding: 6 },
    });

    y = doc.lastAutoTable.finalY + 22;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(ink[0], ink[1], ink[2]);
    doc.text('Meter-wise breakdown', L, y);

    autoTable(doc, {
      startY: y + 8,
      margin: { left: L, right: R },
      theme: 'grid',
      head: [['Meter', 'Previous', 'Current', 'Units', 'Rate (Rs.)', 'Total']],
      body: goodMeters.map((g) => {
        const r = g.r;
        const name = g.meter_name || displayName(g.m, g.i);
        return [
          name,
          fmtN(r.prev),
          fmtN(r.cur),
          fmtN(r.units),
          fmtN(r.rate, 4),
          pdfMoney(r.total),
        ];
      }),
      foot: [
        [
          'Total',
          '',
          '',
          fmtN(totals.units),
          '',
          pdfMoney(totals.total),
        ],
      ],
      headStyles: { fillColor: ink, textColor: 255 },
      footStyles: {
        fillColor: [230, 244, 236],
        textColor: ink,
        fontStyle: 'bold',
      },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
      },
      styles: { fontSize: 9, cellPadding: 5 },
    });
  }

  const safeDate = String(billDate || todayIsoDate()).slice(0, 10);
  doc.save(`electricity-bill-${mode}-${safeDate}.pdf`);
}
