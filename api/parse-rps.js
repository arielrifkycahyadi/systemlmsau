import Busboy from 'busboy';
import { parserService } from '../services/parserService.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

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

  try {
    const busboy = Busboy({ headers: req.headers });
    let fileBuffer = null;
    let fileName = '';
    let fileMimetype = '';

    const filePromise = new Promise((resolve, reject) => {
      busboy.on('file', (name, file, info) => {
        const { filename, mimeType } = info;
        fileName = filename;
        fileMimetype = mimeType;
        const chunks = [];
        file.on('data', (chunk) => chunks.push(chunk));
        file.on('end', () => { fileBuffer = Buffer.concat(chunks); });
      });

      busboy.on('finish', () => {
        if (!fileBuffer) reject(new Error('No file uploaded.'));
        else resolve({ fileBuffer, fileName, fileMimetype });
      });

      busboy.on('error', (err) => reject(err));
    });

    req.pipe(busboy);

    const { fileBuffer: buffer, fileName: name, fileMimetype: mime } = await filePromise;
    const text = await parserService.parseDocument(buffer, mime, name);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({
      fileName: name,
      length: text.length,
      text: text
    });
  } catch (error) {
    console.error(error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ error: `Parsing error: ${error.message}` });
  }
}
