const key = "nce-learning-lab:device-name";
/** A starting name from the browser, e.g. "iphone" or "mac". */
export function guessDeviceName(ua = navigator.userAgent) {
  if (/iPhone/i.test(ua)) return "iphone";
  if (/iPad/i.test(ua)) return "ipad";
  if (/Android/i.test(ua)) return "android";
  if (/Macintosh|Mac OS X/i.test(ua)) return "mac";
  if (/Windows/i.test(ua)) return "windows";
  return "device";
}
/** Letters (any script) and digits joined by "-", safe in iCloud and Drive file names. */
export function cleanDeviceName(name: string) {
  return (
    name
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "device"
  );
}
// Kept per browser on purpose: a restored or merged backup must not rename this device.
export function loadDeviceName() {
  try {
    return localStorage.getItem(key) || guessDeviceName();
  } catch {
    return guessDeviceName();
  }
}
export function saveDeviceName(name: string) {
  try {
    localStorage.setItem(key, cleanDeviceName(name));
  } catch {
    // Storage unavailable (private mode): the name lasts for this visit only.
  }
}
/** e.g. nce-learning-backup-iphone-2026-10-10-2130.json, in local time so files sort by when you studied. */
export function backupFileName(device: string, at = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
  const time = `${pad(at.getHours())}${pad(at.getMinutes())}`;
  return `nce-learning-backup-${cleanDeviceName(device)}-${date}-${time}.json`;
}
