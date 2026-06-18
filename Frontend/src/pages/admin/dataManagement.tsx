import { useState, useEffect, useCallback, useMemo } from "react";
import {
  type LogFile,
  getLogFiles,
  uploadLogFile,
  deleteLogFile,
} from "../../services/admin/dataManagement.service";
import { cacheFileList, cacheFileDownload, getCachedFileList, removeCachedFile, listCachedKeys } from "../../hooks/useCacheStorage";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";

function formatBytes(bytes: number) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`;
  return `${bytes} B`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function FileIcon() {
  return (
    <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd"
        d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
        clipRule="evenodd" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd"
        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
        clipRule="evenodd" />
    </svg>
  );
}

function UploadIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-10 h-10 transition-colors ${active ? "text-blue-400" : "text-gray-300"}`}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
    >
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  );
}

// Badge shown on each file row when it's been pushed to cache
function CachedBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium bg-green-50 text-green-700 border border-green-200 whitespace-nowrap">
      <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clipRule="evenodd" />
      </svg>
      Cached
    </span>
  );
}

export default function DataManagement() {
  const [files, setFiles] = useState<LogFile[]>([]);
  const [search, setSearch] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  // Track which file public_ids have been pushed to Cache Storage
  const [cachedIds, setCachedIds] = useState<Set<string>>(new Set());
  // Track per-file caching in progress
  const [cachingIds, setCachingIds] = useState<Set<string>>(new Set());
  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Scroll to top whenever this page mounts (e.g. navigating in from another page)
  useEffect(() => {
    const container =
      document.querySelector("main") ||
      document.querySelector("[class*='overflow-y']") ||
      document.documentElement;
    container.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Load files on mount — hits Redis cache → DB via backend
  // Falls back to Cache Storage if the API is unreachable
  useEffect(() => {
    getLogFiles()
      .then(async (res: any) => {
        const fetched: LogFile[] = res.data.data;
        setFiles(fetched);
        // Sync the full file list metadata into Cache Storage so it's
        // available offline. Runs in background — doesn't block the UI.
        await cacheFileList(fetched);
        // Reflect which files are already cached as downloads
        const cachedKeys = await listCachedKeys();
        const alreadyCached = new Set(
          fetched
            .filter((f) => cachedKeys.includes(f.secure_url))
            .map((f) => f.public_id)
        );
        setCachedIds(alreadyCached);
      })
      .catch(async () => {
        // Network/API failure — serve from Cache Storage
        const cached = await getCachedFileList();
        if (cached.length > 0) {
          setFiles(cached as LogFile[]);
          setCachedIds(new Set(cached.map((f: any) => f.public_id)));
        } else {
          setErrors(["Failed to load files and no cached data available."]);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Reset to first page whenever the search query changes
  useEffect(() => {
    setPage(0);
  }, [search]);

  /** Push a single file's download into Cache Storage on demand */
  const handleCacheFile = useCallback(
    async (file: LogFile) => {
      setCachingIds((prev) => new Set(prev).add(file.public_id));
      const ok = await cacheFileDownload(file);
      setCachingIds((prev) => {
        const next = new Set(prev);
        next.delete(file.public_id);
        return next;
      });
      if (ok) {
        setCachedIds((prev) => new Set(prev).add(file.public_id));
      } else {
        setErrors([`Could not cache ${file.name}. The URL may not support CORS.`]);
      }
    },
    [cacheFileDownload]
  );

  async function handleFiles(incoming: FileList | File[]) {
    const list = Array.from(incoming);
    setUploading(list.map((f) => f.name));
    setErrors([]);

    const results = await Promise.allSettled(list.map((f) => uploadLogFile(f)));

    const uploaded: LogFile[] = [];
    const errs: string[] = [];

    results.forEach((r, i) => {
      if (r.status === "fulfilled") uploaded.push(r.value.data.data);
      else
        errs.push(
          `${list[i].name}: ${
            (r.reason as any)?.response?.data?.message ?? "Upload failed"
          }`
        );
    });

    const next = [...uploaded, ...files];
    setFiles(next);
    setUploading([]);
    if (errs.length) setErrors(errs);

    // Update the cached metadata list to include newly uploaded files
    await cacheFileList(next);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) handleFiles(e.target.files);
  }

  async function handleDelete(file: LogFile) {
    try {
      await deleteLogFile(file.public_id);
      const next = files.filter((f) => f.public_id !== file.public_id);
      setFiles(next);
      // Remove from Cache Storage and update metadata
      await removeCachedFile(file.secure_url);
      await cacheFileList(next);
      setCachedIds((prev) => {
        const next = new Set(prev);
        next.delete(file.public_id);
        return next;
      });
    } catch {
      setErrors([`Could not delete ${file.name}. Please try again.`]);
    }
  }

  const filtered = useMemo(
    () => files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase())),
    [files, search]
  );

  const paginatedFiltered = filtered.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const TABLE_HEADERS = ["File", "Size", "Uploaded", "Status", "Actions"];

  // Shared action buttons for the desktop table (compact icon-only)
  const renderTableActions = (file: LogFile) => (
    <div className="flex items-center gap-1">
      {!cachedIds.has(file.public_id) && (
        <button
          onClick={() => handleCacheFile(file)}
          disabled={cachingIds.has(file.public_id)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Cache for offline access"
        >
          {cachingIds.has(file.public_id) ? (
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0115-3M20 15a9 9 0 01-15 3" />
            </svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" />
            </svg>
          )}
        </button>
      )}

      <a
        href={file.secure_url}
        download={file.name}
        target="_blank"
        rel="noopener noreferrer"
        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
        title="Download"
      >
        <DownloadIcon />
      </a>
      <button
        onClick={() => handleDelete(file)}
        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
        title="Delete"
      >
        <TrashIcon />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-1.5 text-sm font-bold text-green-600 hover:text-green-700 transition-colors mb-4 group"
          >
            <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clipRule="evenodd" />
            </svg>
            Back
          </button>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight">Data Management</h1>
          <p className="text-sm sm:text-md text-gray-700 mt-1">
            Upload and download diagnostic logs and client data exports.
          </p>
        </div>

        {/* Error banner */}
        {errors.length > 0 && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 space-y-1">
            {errors.map((e, i) => (
              <p key={i}>{e}</p>
            ))}
          </div>
        )}

        {/* Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`rounded-xl border-2 border-dashed transition-colors duration-150 cursor-pointer ${
            dragging
              ? "border-blue-400 bg-blue-50"
              : "border-gray-400 bg-white hover:border-gray-700 hover:bg-gray-50"
          }`}
        >
          <label className="flex flex-col items-center justify-center gap-3 py-10 sm:py-14 cursor-pointer">
            <input
              type="file"
              accept=".log,.txt,.zip"
              className="hidden"
              multiple
              onChange={handleInputChange}
            />
            <UploadIcon active={dragging} />
            <div className="text-center px-4">
              {uploading.length > 0 ? (
                <p className="text-sm font-medium text-blue-600 animate-pulse">
                  Uploading {uploading.length} file{uploading.length > 1 ? "s" : ""}…
                </p>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-700">
                    Drop log files here or click to upload
                  </p>
                  <p className="text-xs text-gray-700 mt-1">
                    Supports .log, .txt, .zip — max 50 MB per file
                  </p>
                </>
              )}
            </div>
          </label>
        </div>

        {/* File List */}
        <div>
          {/* Filter / Header bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:p-5 bg-white border border-gray-700 border-b-0 rounded-t-xl">
            <div>
              <h2 className="text-md font-semibold text-gray-800">Log Files</h2>
              <p className="text-xs text-gray-700 mt-0.5">
                {filtered.length} file{filtered.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="relative w-full sm:w-52">
              <svg
                className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                viewBox="0 0 20 20" fill="currentColor"
              >
                <path fillRule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clipRule="evenodd" />
              </svg>
              <input
                type="text"
                placeholder="Search files..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-sm bg-gray-50 border border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition"
              />
            </div>
          </div>

          {/* ── Mobile Cards (sm and below) ── */}
          <div className="sm:hidden bg-white border border-gray-700 border-t-0 rounded-b-xl divide-y divide-gray-50">
            {loading && (
              <div className="py-16 text-center text-gray-400 text-sm animate-pulse">
                Loading files…
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <svg className="w-8 h-8 mb-2 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <p className="text-sm">
                  {search ? "No files match your search." : "No files uploaded yet."}
                </p>
              </div>
            )}

            {!loading && filtered.length > 0 && (
              <>
                {paginatedFiltered.map((file) => (
                  <div key={file.public_id} className="p-4 space-y-3">
                    {/* Top row: icon + name + cached badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center mt-0.5">
                          <FileIcon />
                        </div>
                        <p className="font-medium text-gray-900 text-sm truncate pt-1.5">
                          {file.name}
                        </p>
                      </div>
                      {cachedIds.has(file.public_id) && (
                        <div className="flex-shrink-0">
                          <CachedBadge />
                        </div>
                      )}
                    </div>

                    {/* Detail grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs pl-12">
                      <div>
                        <p className="text-gray-400">Size</p>
                        <p className="font-medium text-gray-700">{formatBytes(file.size)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Uploaded</p>
                        <p className="text-gray-600">{formatDate(file.created_at)}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-wrap pl-12">
                      {!cachedIds.has(file.public_id) && (
                        <button
                          onClick={() => handleCacheFile(file)}
                          disabled={cachingIds.has(file.public_id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-green-50 hover:text-green-600 hover:border-green-200 transition-all disabled:opacity-40"
                        >
                          {cachingIds.has(file.public_id) ? (
                            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0115-3M20 15a9 9 0 01-15 3" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" />
                            </svg>
                          )}
                          Cache
                        </button>
                      )}
                      <a
                        href={file.secure_url}
                        download={file.name}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all"
                      >
                        <DownloadIcon /> Download
                      </a>
                      <button
                        onClick={() => handleDelete(file)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"
                      >
                        <TrashIcon /> Delete
                      </button>
                    </div>
                  </div>
                ))}

                {/* Mobile Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
                  <span>
                    {page * rowsPerPage + 1}–
                    {Math.min((page + 1) * rowsPerPage, filtered.length)} of{" "}
                    {filtered.length}
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={page === 0}
                      onClick={() => setPage((p) => p - 1)}
                      className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                    >
                      ‹ Prev
                    </button>
                    <button
                      disabled={(page + 1) * rowsPerPage >= filtered.length}
                      onClick={() => setPage((p) => p + 1)}
                      className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                    >
                      Next ›
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Desktop MUI Table (sm and above) ── */}
          <Paper
            elevation={0}
            className="hidden sm:block"
            sx={{
              width: "100%",
              overflow: "hidden",
              borderRadius: "0 0 12px 12px",
              border: "1px solid #374151",
              borderTop: "none",
            }}
          >
            {loading && (
              <div className="py-16 text-center text-gray-400 text-sm animate-pulse">
                Loading files…
              </div>
            )}

            {!loading && (
              <>
                <TableContainer sx={{ maxHeight: 560 }}>
                  <Table stickyHeader aria-label="log files table">
                    <TableHead>
                      <TableRow>
                        {TABLE_HEADERS.map((h) => (
                          <TableCell
                            key={h}
                            sx={{
                              backgroundColor: "#ffffff",
                              fontWeight: 600,
                              fontSize: "0.875rem",
                              color: "#6b7280",
                              letterSpacing: "0.05em",
                              borderBottom: "1px solid #374151",
                              py: 1.75,
                              px: 2.5,
                              fontFamily: "inherit",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedFiltered.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            align="center"
                            sx={{ py: 8, border: "none", fontFamily: "inherit" }}
                          >
                            <p className="text-gray-400 text-sm">
                              {search ? "No files match your search." : "No files uploaded yet."}
                            </p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedFiltered.map((file) => (
                          <TableRow
                            key={file.public_id}
                            hover
                            sx={{
                              "&:hover": {
                                backgroundColor: "rgba(249,250,251,0.8)",
                              },
                              "& td": {
                                borderBottom: "1px solid #374151",
                                py: 1.5,
                                px: 2.5,
                                fontFamily: "inherit",
                              },
                            }}
                          >
                            <TableCell>
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                                  <FileIcon />
                                </div>
                                <span className="font-medium text-gray-900 text-xs truncate max-w-[220px]">
                                  {file.name}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-gray-600 text-xs whitespace-nowrap">
                                {formatBytes(file.size)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-gray-500 text-xs whitespace-nowrap">
                                {formatDate(file.created_at)}
                              </span>
                            </TableCell>
                            <TableCell>
                              {cachedIds.has(file.public_id) ? (
                                <CachedBadge />
                              ) : (
                                <span className="text-gray-300 text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {renderTableActions(file)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                <TablePagination
                  rowsPerPageOptions={[10, 20, 50, 100]}
                  component="div"
                  count={filtered.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={(_: unknown, newPage: number) => setPage(newPage)}
                  onRowsPerPageChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setRowsPerPage(Number(e.target.value));
                    setPage(0);
                  }}
                  sx={{
                    borderTop: "1px solid #374151",
                    fontSize: "0.875rem",
                    color: "#64748b",
                    fontFamily: "inherit",
                    "& .MuiTablePagination-select": {
                      fontSize: "0.875rem",
                      fontFamily: "inherit",
                    },
                    "& .MuiTablePagination-displayedRows": {
                      fontSize: "0.875rem",
                      fontFamily: "inherit",
                    },
                    "& .MuiTablePagination-selectLabel": {
                      fontSize: "0.875rem",
                      fontFamily: "inherit",
                    },
                    "& .MuiIconButton-root": {
                      color: "#64748b",
                      "&:hover": { backgroundColor: "#f8fafc" },
                      "&.Mui-disabled": { opacity: 0.4 },
                    },
                  }}
                />
              </>
            )}
          </Paper>
        </div>
      </div>
    </div>
  );
}