// Store the pending File object in memory — no size limit, no base64 overhead
let _file: File | null = null

export function setPendingFile(file: File) { _file = file }
export function getPendingFile() { return _file }
export function clearPendingFile() { _file = null }
