const axios = require('axios');
const { v2: cloudinary } = require('cloudinary');

// Customer file backups are stored in Cloudinary as private ("authenticated")
// raw files: they can only be fetched with a URL signed by this server.
// Cloudinary is configured in app.js.
const OPTIONS = { resource_type: 'raw', type: 'authenticated' };
const ROOT = 'vision-tech/file-backups';

const backupPrefix = (userId, backupId) => `${ROOT}/${userId}/${backupId}/`;

const putPart = (publicId, buffer) =>
  new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream({ ...OPTIONS, public_id: publicId, overwrite: true }, (error, result) =>
      error ? reject(error) : resolve(result)
    );
    upload.end(buffer);
  });

const getPartStream = async (publicId) => {
  const url = cloudinary.url(publicId, { ...OPTIONS, sign_url: true, secure: true });
  const { data } = await axios.get(url, { responseType: 'stream' });
  return data;
};

const deletePrefix = (prefix) => cloudinary.api.delete_resources_by_prefix(prefix, OPTIONS);

module.exports = { backupPrefix, putPart, getPartStream, deletePrefix };
