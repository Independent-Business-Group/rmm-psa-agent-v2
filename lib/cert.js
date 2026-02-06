// lib/cert.js
// Handles agent keypair and certificate logic
const fs = require('fs');
const path = require('path');
const { generateKeyPairSync, createSign, publicEncrypt, privateDecrypt } = require('crypto');
function encryptToken(publicKey, token) {
  return publicEncrypt(publicKey, Buffer.from(token)).toString('base64');
}

function decryptToken(privateKey, encrypted) {
  return privateDecrypt(privateKey, Buffer.from(encrypted, 'base64')).toString('utf8');
}

const CERT_PATH = path.join(__dirname, '../state/agent-cert.pem');
const KEY_PATH = path.join(__dirname, '../state/agent-key.pem');

function ensureKeypair() {
  if (fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH)) {
    return {
      privateKey: fs.readFileSync(KEY_PATH, 'utf8'),
      certificate: fs.readFileSync(CERT_PATH, 'utf8'),
    };
  }
  // Generate keypair
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  fs.writeFileSync(KEY_PATH, privateKey);
  // For demo, use publicKey as CSR
  fs.writeFileSync(CERT_PATH, publicKey);
  return { privateKey, certificate: publicKey };
}

function getCSR() {
  // For demo, just return the public key as the CSR
  const { certificate } = ensureKeypair();
  return certificate;
}

module.exports = { ensureKeypair, getCSR, CERT_PATH, KEY_PATH, encryptToken, decryptToken };
