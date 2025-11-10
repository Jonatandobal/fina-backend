// src/config/afip.js
const Afip = require('@afipsdk/afip.js');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

async function createAfipInstance(certData) {
  const { cuit, cert_content, key_content, ambiente = 'homologacion' } = certData;

  const tempDir = path.join(os.tmpdir(), 'afip-certs', cuit);
  await fs.mkdir(tempDir, { recursive: true });

  const certPath = path.join(tempDir, 'cert.crt');
  const keyPath = path.join(tempDir, 'key.key');

  await fs.writeFile(certPath, cert_content);
  await fs.writeFile(keyPath, key_content);

  const afip = new Afip({
    CUIT: cuit,
    cert: certPath,
    key: keyPath,
    production: ambiente === 'produccion',
    ta_folder: tempDir
  });

  return afip;
}

async function cleanupTempCerts(cuit) {
  try {
    const tempDir = path.join(os.tmpdir(), 'afip-certs', cuit);
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    console.error('Error cleaning up temp certs:', error);
  }
}

module.exports = {
  createAfipInstance,
  cleanupTempCerts
};
