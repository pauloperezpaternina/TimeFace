import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// Utility to format date and time for reports
const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
};

const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
};

const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
};

export const exportToPdf = (title: string, headers: string[], data: any[][], filename: string) => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text(title, 14, 22);

    autoTable(doc, {
        startY: 30,
        head: [headers],
        body: data,
        theme: 'striped',
        styles: {
            fontSize: 8,
            cellPadding: 2,
        },
        headStyles: {
            fillColor: [48, 63, 159], // A nice blue color
            textColor: [255, 255, 255],
            fontStyle: 'bold',
        },
        alternateRowStyles: {
            fillColor: [240, 240, 240],
        },
        columnStyles: {
            // Example: align first column to left, others to center
            0: { halign: 'left' },
        },
    });

    doc.save(`${filename}.pdf`);
};

export const exportToExcel = (data: any[], filename: string) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
    saveAs(blob, `${filename}.xlsx`);
};

export const formatters = {
    formatDateTime,
    formatDate,
    formatTime
};