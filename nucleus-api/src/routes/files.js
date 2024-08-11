const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { db } = require('../../config/firebase');

const router = express.Router();

// Set up Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `${req.body.productId}-${req.body.version}-${file.originalname}`);
  }
});

const upload = multer({ storage: storage });

// Endpoint to upload a file
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { productId, version } = req.body;
    const file = req.file;

    if (!productId || !version || !file) {
      return res.status(400).json({ error: 'Product ID, version, and file are required' });
    }

    // Save metadata to Firestore
    const fileData = {
      productId,
      version,
      filePath: file.path,
      originalName: file.originalname,
      uploadDate: new Date()
    };

    await db.collection('files').add(fileData);

    res.status(201).json({ message: 'File uploaded successfully', fileData });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload file: ' + error.message });
  }
});

// Endpoint to download a file by product ID and version
router.get('/download', async (req, res) => {
  try {
    const { productId, version, type } = req.query;

    if (!productId || !version) {
      return res.status(400).json({ error: 'Product ID and version are required' });
    }

    // Fetch file metadata from Firestore
    const fileSnapshot = await db.collection('files')
      .where('productId', '==', productId)
      .where('version', '==', version)
      .get();

    if (fileSnapshot.empty) {
      return res.status(404).json({ error: 'File not found' });
    }

    const fileData = fileSnapshot.docs[0].data();

    const filePath = fileData.filePath;

    if (type === 'bytes') {
      // Stream the file as bytes
      const fileBuffer = fs.readFileSync(filePath);
      res.setHeader('Content-Disposition', `attachment; filename=${fileData.originalName}`);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.send(fileBuffer);
    } else {
      // Stream the file as a regular download
      const fileStream = fs.createReadStream(filePath);
      res.setHeader('Content-Disposition', `attachment; filename=${fileData.originalName}`);
      res.setHeader('Content-Type', 'application/octet-stream');
      fileStream.pipe(res);

      fileStream.on('error', (error) => {
        console.error('Error reading the file:', error.message);
        res.status(500).json({ error: 'Failed to download file: ' + error.message });
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to download file: ' + error.message });
  }
});

module.exports = router;
