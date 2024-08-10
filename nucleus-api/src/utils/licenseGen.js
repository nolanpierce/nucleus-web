const { db } = require('../../config/firebase');

async function generateRandomSegment() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let segment = '';
    for (let i = 0; i < 4; i++) {
        segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return segment;
}

async function generateUniqueLicenseKey() {
    let licenseKey;
    let isUnique = false;

    while (!isUnique) {
        const segment1 = await generateRandomSegment();
        const segment2 = await generateRandomSegment();
        const segment3 = await generateRandomSegment();
        licenseKey = `${segment1}-${segment2}-${segment3}`;

        // Check if the license key is unique across the entire collection
        const existingLicense = await db.collection('licenses')
            .where('licenseKey', '==', licenseKey)
            .get();

        if (existingLicense.empty) {
            isUnique = true;
        }
    }

    return licenseKey;
}

module.exports = {
    generateUniqueLicenseKey
};