import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export const reportService = {
  // --- EXCEL REPORT COMPILER ---
  async generateExcelBuffer(courseName, studentData, attendanceLogs) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Course Report');

    // Title Row
    sheet.mergeCells('A1:G1');
    const titleRow = sheet.getRow(1);
    titleRow.getCell(1).value = `AU LEARNING - COURSE PERFORMANCE REPORT`;
    titleRow.getCell(1).font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFF' } };
    titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4F46E5' } };
    titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 35;

    // Metadata Block
    sheet.getCell('A3').value = 'Course Name:';
    sheet.getCell('A3').font = { bold: true };
    sheet.getCell('B3').value = courseName;

    sheet.getCell('A4').value = 'Creator:';
    sheet.getCell('A4').font = { bold: true };
    sheet.getCell('B4').value = 'Ariel Usman';

    sheet.getCell('A5').value = 'Socials:';
    sheet.getCell('A5').font = { bold: true };
    sheet.getCell('B5').value = '@arielrcun & @madeai.ariel (Instagram) | @maybe.ariel5 (TikTok)';

    sheet.getCell('A6').value = 'Date Generated:';
    sheet.getCell('A6').font = { bold: true };
    sheet.getCell('B6').value = new Date().toLocaleDateString();

    sheet.addRow([]); // Spacer

    // Headers
    const headers = ['Student Name', 'Email', 'Submissions', 'Attendance Count', 'Attendance Rate', 'Average Grade', 'Course Status'];
    sheet.addRow(headers);
    
    const headerRow = sheet.getRow(8);
    headerRow.height = 25;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E1B4B' } };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });

    // Populate data
    studentData.forEach((student) => {
      const avg = student.avgScore || 0;
      let status = 'Fail';
      if (avg >= 80) status = 'Excellent';
      else if (avg >= 60) status = 'Pass';

      sheet.addRow([
        student.name,
        student.email,
        student.submissionsCount || 0,
        student.attendanceCount || 0,
        `${student.attendanceRate || 0}%`,
        avg,
        status
      ]);
    });

    // Auto-adjust column sizes
    sheet.columns.forEach((column) => {
      let maxLen = 0;
      column.eachCell({ includeEmpty: false }, (cell) => {
        const valLen = cell.value ? cell.value.toString().length : 0;
        if (valLen > maxLen) maxLen = valLen;
      });
      column.width = Math.max(maxLen + 2, 12);
    });

    return await workbook.xlsx.writeBuffer();
  },

  // --- PDF REPORT COMPILER ---
  generatePDFBuffer(courseName, studentData, attendanceLogs) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        // Branding Banner Header
        doc.rect(0, 0, 612, 110).fill('#4F46E5');
        doc.fillColor('#FFFFFF')
           .fontSize(20)
           .text('AU LEARNING MANAGEMENT SYSTEM', 50, 35, { bold: true })
           .fontSize(11)
           .text('Alternative Universe Learning Platform by Ariel Usman', 50, 65);

        // Meta Details
        doc.fillColor('#1F2937').fontSize(11);
        doc.text(`Course Syllabus: ${courseName}`, 50, 140, { bold: true });
        doc.text(`Instructor Creator: Ariel Usman (@arielrcun | @madeai.ariel)`, 50, 160);
        doc.text(`GitHub Pages Portfolio: https://artriel-arch.github.io/`, 50, 180);
        doc.text(`AI Systems GitHub: https://arielrifkycahyadi.github.io/`, 50, 200);
        doc.text(`Date of Audit: ${new Date().toLocaleDateString()}`, 50, 220);

        doc.moveTo(50, 245).lineTo(562, 245).stroke('#E5E7EB');

        // Draw Summary Table
        doc.fontSize(14).text('Student Performance Aggregate', 50, 265, { bold: true });

        let y = 295;
        // Table Header
        doc.rect(50, y, 512, 20).fill('#1E1B4B');
        doc.fillColor('#FFFFFF').fontSize(8.5);
        doc.text('Student Name', 55, y + 5, { width: 130 });
        doc.text('Email', 190, y + 5, { width: 145 });
        doc.text('Submissions', 345, y + 5, { width: 60 });
        doc.text('Attendance', 415, y + 5, { width: 60 });
        doc.text('Avg Grade', 485, y + 5, { width: 60 });

        y += 20;

        // Draw student rows
        studentData.forEach((student, index) => {
          // Zebra striping
          if (index % 2 === 0) {
            doc.rect(50, y, 512, 20).fill('#F9FAFB');
          } else {
            doc.rect(50, y, 512, 20).fill('#FFFFFF');
          }

          doc.fillColor('#1F2937');
          doc.text(student.name || 'Student Name', 55, y + 5, { width: 130 });
          doc.text(student.email || 'Email', 190, y + 5, { width: 145 });
          doc.text(String(student.submissionsCount || 0), 345, y + 5, { width: 60 });
          doc.text(`${student.attendanceRate || 0}%`, 415, y + 5, { width: 60 });
          doc.text(String(student.avgScore || 0), 485, y + 5, { width: 60 });

          y += 20;

          if (y > 700) {
            doc.addPage();
            y = 50;
          }
        });

        // Branding Footer
        doc.fillColor('#9CA3AF').fontSize(8);
        doc.text('AU Learning by Ariel Usman - TikTok: @maybe.ariel5 | Instagram: @arielrcun', 50, 735, { align: 'center' });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
};
