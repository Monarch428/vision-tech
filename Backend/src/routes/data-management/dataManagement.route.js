const express = require("express");
const multer = require("multer");
const { protect } = require("../../middleware/auth.middleware");
const {
  uploadLogFile,
  getLogFiles,
  deleteLogFile,
} = require("../../controllers/data-management/dataManagement.controller");

const router = express.Router();

// Multer configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
  },
  fileFilter: (req, file, cb) => {
    const allowed = [".log", ".txt", ".zip"];
    const ext = "." + file.originalname.split(".").pop().toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only .log, .txt, and .zip files are allowed"));
    }
  },
});

router.post("/upload", protect, upload.single("file"), uploadLogFile);
router.get("/files", protect, getLogFiles);
router.delete("/files/:publicId", protect, deleteLogFile);

module.exports = router;