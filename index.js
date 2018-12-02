const admin = require('firebase-admin');
const axios = require('axios');
const serviceAccount = require('./serviceAccount.json');
const firebaseConfig = require('./firebase.config.js');
const fs = require('fs');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    ...firebaseConfig
});

const database = admin.database();
const bucket = admin.storage().bucket();

const urlWatcherRef = database.ref('urls');
urlWatcherRef.on('child_added', async snapshot => {
    const key = snapshot.key;
    const urlObject = snapshot.val();

    const result = await axios.get(urlObject.url).catch(e => {
        urlWatcherRef.child(key).child('error').set(e.toLocaleString());
    });

    if (!('status' in result)) {
        return;
    }

    urlWatcherRef.child(key).child('status').set(result.status);
    urlWatcherRef.child(key).child('error').remove();

    if (result.status === 200) {
        const contentType = result.headers['content-type'];
        const localFilePath = `files/${key}`;
        fs.writeFileSync(localFilePath, result.data);
        const fileInfo = await bucket.upload(localFilePath, {metadata: {cacheControl: 'public, max-age=31536000'}, contentType});
        urlWatcherRef.child(key).child('file/content-type').set(contentType);
        urlWatcherRef.child(key).child('file/name').set(key);
    }
});
