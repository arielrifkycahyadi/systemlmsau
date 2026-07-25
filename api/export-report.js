import { reportService } from '../services/reportService.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { courseName, type, studentData, attendanceLogs } = req.body;

  try {
    if (type === 'pdf') {
      const buffer = await reportService.generatePDFBuffer(courseName, studentData, attendanceLogs || []);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Report_${courseName.replace(/\s+/g, '_')}.pdf"`);
      res.status(200).send(buffer);
    } else {
      const buffer = await reportService.generateExcelBuffer(courseName, studentData, attendanceLogs || []);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="Report_${courseName.replace(/\s+/g, '_')}.xlsx"`);
      res.status(200).send(buffer);
    }
  } catch (error) {
    console.error(error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ error: `Reporting error: ${error.message}` });
  }
}
