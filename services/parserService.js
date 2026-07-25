import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import ExcelJS from 'exceljs';

export const parserService = {
  async parseDocument(buffer, mimeType, originalName = '') {
    const nameLower = originalName.toLowerCase();
    
    // Check text formats
    if (mimeType.startsWith('text/') || nameLower.endsWith('.txt') || nameLower.endsWith('.csv') || nameLower.endsWith('.json')) {
      return buffer.toString('utf8');
    }

    // Check PDF
    if (mimeType === 'application/pdf' || nameLower.endsWith('.pdf')) {
      const data = await pdfParse(buffer);
      return data.text;
    }

    // Check Docx
    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      nameLower.endsWith('.docx')
    ) {
      const data = await mammoth.extractRawText({ buffer });
      return data.value;
    }

    // Check Excel
    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel' ||
      nameLower.endsWith('.xlsx') ||
      nameLower.endsWith('.xls')
    ) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const textSheets = [];
      
      workbook.eachSheet((sheet) => {
        const sheetText = [];
        sheet.eachRow((row) => {
          const rowText = [];
          row.eachCell((cell) => {
            rowText.push(cell.text || String(cell.value || ''));
          });
          sheetText.push(rowText.join('\t'));
        });
        textSheets.push(`Sheet: ${sheet.name}\n${sheetText.join('\n')}`);
      });
      return textSheets.join('\n\n');
    }

    throw new Error(`Unsupported document mimetype: ${mimeType || 'unknown'}`);
  }
};
