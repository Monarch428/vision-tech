const crypto = require('crypto');

// AES-256-GCM encryption for secrets stored in the database (e.g. the SMTP password).
// Encrypted values look like "enc:v1:<iv>:<tag>:<ciphertext>" (base64 parts).
// Without CONFIG_ENCRYPTION_KEY values are stored as-is, so existing data keeps working.
const PREFIX = 'enc:v1:';

const getKey = () => {
  const raw = process.env.CONFIG_ENCRYPTION_KEY;
  return raw ? crypto.createHash('sha256').update(raw).digest() : null;
};

const encryptSecret = (plain) => {
  if (!plain || String(plain).startsWith(PREFIX)) return plain;
  const key = getKey();
  if (!key) return plain;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${data.toString('base64')}`;
};

const decryptSecret = (value) => {
  if (!value || !String(value).startsWith(PREFIX)) return value;
  const key = getKey();
  if (!key) {
    throw new Error('CONFIG_ENCRYPTION_KEY is required to read an encrypted secret');
  }

  const [iv, tag, data] = String(value).slice(PREFIX.length).split(':').map((p) => Buffer.from(p, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
};

module.exports = { encryptSecret, decryptSecret };
