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

    const fileSize = fs.statSync(file.path).size;

    // Save metadata to Firestore
    const fileData = {
      productId,
      version,
      filePath: file.path,
      originalName: file.originalname,
      fileSize,
      uploadDate: new Date()
    };

    await db.collection('files').add(fileData);

    res.status(201).json({ message: 'File uploaded successfully', fileSize });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload file: ' + error.message });
  }
});

// Endpoint to download a file by product ID and version
router.get('/download', async (req, res) => {
  try {
    const { productId, productName, type } = req.query;

    if (!productId && !productName) {
      return res.status(400).json({ error: 'Product ID or product name is required' });
    }

    // Fetch file metadata from Firestore
    let fileSnapshot;
    if (productId) {
      fileSnapshot = await db.collection('files').where('productId', '==', productId).get();
    } else if (productName) {
      fileSnapshot = await db.collection('files').where('originalName', '==', productName).get();
    }

    if (fileSnapshot.empty) {
      return res.status(404).json({ error: 'File not found' });
    }

    const fileData = fileSnapshot.docs[0].data();
    const filePath = fileData.filePath;
    const fileSize = fileData.fileSize;

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

      fileStream.on('end', () => {
        res.status(200).json({ message: 'File downloaded successfully', fileSize });
      });

      fileStream.on('error', (error) => {
        console.error('Error reading the file:', error.message);
        res.status(500).json({ error: 'Failed to download file: ' + error.message });
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to download file: ' + error.message });
  }
});

router.delete('/delete-file', async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    // Fetch the file to delete from Firestore
    const fileSnapshot = await db.collection('files').where('productId', '==', productId).get();

    if (fileSnapshot.empty) {
      return res.status(404).json({ error: 'File not found' });
    }

    const fileDoc = fileSnapshot.docs[0];
    const fileData = fileDoc.data();

    // Delete the file from the filesystem
    fs.unlinkSync(fileData.filePath);

    // Delete the file metadata from Firestore
    await fileDoc.ref.delete();

    res.status(200).json({ message: 'File deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete file: ' + error.message });
  }
});

router.get('/product-version', async (req, res) => {
  try {
    const { productId } = req.query;

    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    const fileSnapshot = await db.collection('files').where('productId', '==', productId).get();

    if (fileSnapshot.empty) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const fileData = fileSnapshot.docs[0].data();

    res.status(200).json({ version: fileData.version });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve product version: ' + error.message });
  }
});

router.get('/all-files', async (req, res) => {
  try {
    const filesSnapshot = await db.collection('files').get();

    if (filesSnapshot.empty) {
      return res.status(404).json({ error: 'No files found' });
    }

    const files = filesSnapshot.docs.map(doc => doc.data());

    res.status(200).json({ files });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve file info: ' + error.message });
  }
});

module.exports = router;
