const { v2: cloudinary } = require("cloudinary");
const { Readable } = require("stream");
const LogFile = require("../../models/log-file/Logfile.js");
const systemLogger = require("../../utils/systemLogger");

function streamUpload(buffer, fileName) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "log-files",
        resource_type: "raw",
        public_id: fileName,
        use_filename: true,
        unique_filename: false,
        overwrite: true,
      },
      (error, result) => {
        if (error || !result) return reject(error || new Error("Upload failed"));
        resolve(result);
      }
    );
    Readable.from(buffer).pipe(uploadStream);
  });
}

const uploadLogFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file provided" });
    }
    const result = await streamUpload(req.file.buffer, req.file.originalname);
    const logFile = await LogFile.create({
      public_id: result.public_id,
      name: req.file.originalname,
      size: result.bytes,
      secure_url: result.secure_url,
      format: result.format || req.file.originalname.split(".").pop() || "raw",
      created_at: result.created_at,
    });

    await systemLogger({
      type: "success",
      action: "LOG_FILE_UPLOADED",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Log file uploaded: ${req.file.originalname} (${result.bytes} bytes, record ${logFile._id})`,
      module: "log-files",
      ipAddress: req.ip,
    });

    return res.status(201).json({ success: true, data: logFile });
  } catch (error) {
    await systemLogger({
      type: "error",
      action: "LOG_FILE_UPLOAD_ERROR",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: req.file?.originalname
        ? `Failed to upload ${req.file.originalname}: ${error.message}`
        : error.message,
      module: "log-files",
      ipAddress: req.ip,
    });

    return res.status(500).json({ success: false, message: error.message });
  }
};

const getLogFiles = async (req, res) => {
  try {
    const files = await LogFile.find().sort({ created_at: -1 });

    // Allow the browser and service worker to cache this list for 60 seconds.
    // stale-while-revalidate lets the SW serve from cache instantly and
    // refresh in the background — the file list stays snappy.
    res.set({
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      "Vary": "Accept-Encoding",
    });

    return res.status(200).json({ success: true, data: files });
  } catch (error) {
    await systemLogger({
      type: "error",
      action: "LOG_FILES_FETCH_ERROR",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: error.message,
      module: "log-files",
      ipAddress: req.ip,
    });

    return res.status(500).json({ success: false, message: error.message });
  }
};

const deleteLogFile = async (req, res) => {
  try {
    const public_id = decodeURIComponent(req.params.publicId);
    await cloudinary.uploader.destroy(public_id, { resource_type: "raw" });
    await LogFile.findOneAndDelete({ public_id });

    await systemLogger({
      type: "success",
      action: "LOG_FILE_DELETED",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: `Log file deleted (public_id: ${public_id})`,
      module: "log-files",
      ipAddress: req.ip,
    });

    return res.status(200).json({ success: true, message: "File deleted successfully" });
  } catch (error) {
    await systemLogger({
      type: "error",
      action: "LOG_FILE_DELETE_ERROR",
      user: req.user?._id,
      userEmail: req.user?.email,
      details: req.params?.publicId
        ? `Failed to delete ${decodeURIComponent(req.params.publicId)}: ${error.message}`
        : error.message,
      module: "log-files",
      ipAddress: req.ip,
    });

    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { uploadLogFile, getLogFiles, deleteLogFile };