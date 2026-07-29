const https = require('https');
const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, 'public', 'models');
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}

const baseUrl = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';

const files = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model-shard1',
  'ssd_mobilenetv1_model-shard2',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2'
];

const downloadFile = (file) => {
  return new Promise((resolve, reject) => {
    const filePath = path.join(modelsDir, file);
    if (fs.existsSync(filePath)) {
      console.log(`Skipping ${file}, already exists`);
      return resolve();
    }
    const fileStream = fs.createWriteStream(filePath);
    console.log(`Downloading ${file}...`);
    https.get(baseUrl + file, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
         console.log('Redirecting to ', response.headers.location);
         https.get(response.headers.location, (res) => {
            res.pipe(fileStream);
            fileStream.on('finish', () => {
              fileStream.close();
              console.log(`Downloaded ${file}`);
              resolve();
            });
         }).on('error', (err) => {
            fs.unlink(filePath, () => {});
            reject(err);
         });
         return;
      }
      if (response.statusCode !== 200) {
        return reject(new Error(`Failed to download ${file}, status: ${response.statusCode}`));
      }
      response.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        console.log(`Downloaded ${file}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filePath, () => {});
      reject(err);
    });
  });
};

(async () => {
  try {
    for (const file of files) {
      await downloadFile(file);
    }
    console.log('All models downloaded.');
  } catch (error) {
    console.error('Error downloading models:', error);
  }
})();
