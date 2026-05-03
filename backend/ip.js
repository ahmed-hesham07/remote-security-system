const os = require('os');

function isPrivateV4(ip) {
  return (
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  );
}

/**
 * Best-effort LAN IP detection for the current machine.
 * - Prefers private IPv4 that isn't internal/loopback.
 * - If HOST_IP is provided, it wins.
 *
 * Note: inside Docker on Windows/macOS this may return a container IP.
 */
function detectHostIp() {
  if (process.env.HOST_IP) return process.env.HOST_IP;

  const ifaces = os.networkInterfaces();
  const candidates = [];

  for (const infos of Object.values(ifaces)) {
    for (const info of infos || []) {
      if (info.family !== 'IPv4') continue;
      if (info.internal) continue;
      if (!isPrivateV4(info.address)) continue;
      candidates.push(info.address);
    }
  }

  return candidates[0] || 'localhost';
}

module.exports = { detectHostIp };

