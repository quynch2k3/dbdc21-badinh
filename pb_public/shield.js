/** * GOVERNMENT STANDARD ID SHIELDING SYSTEM - V15 * TDP21 BA DINH - SECURITY MODULE */ const SHIELD_SALT = "TDP21-ALPHA";
const SHIELD_PREFIXES = ['gov-v2-', 'std-v1-', 'secure-id-', 'post-shd-', 'gov-std-', 'gov-v1-', 'shield-v2-', 'post-x-']; /** * Encodes a plain PocketBase ID into a professional shielded token * Result: gov-v2-abcshdxyz... */
function encodeArticleId(id) { if (!id || id.length < 5) return id; try { const prefix = SHIELD_PREFIXES[id.charCodeAt(0) % SHIELD_PREFIXES.length]; const b64 = btoa(id + "|" + SHIELD_SALT).replace(/=/g, ""); const split = 5; const p1 = b64.substring(0, split); const p2 = b64.substring(split); return `${prefix}${p1}shd${p2}`; } catch (e) { return id; }
} /** * Decodes a shielded token back to a plain ID */
function decodeArticleId(token) { if (!token) return ''; let matchedPrefix = null; for (const p of SHIELD_PREFIXES) { if (token.startsWith(p)) { matchedPrefix = p; break; } } if (!matchedPrefix) return token; try { let hash = token.substring(matchedPrefix.length).replace('shd', ''); while (hash.length % 4 !== 0) hash += '='; const decoded = atob(hash); return decoded.split('|')[0]; } catch (e) { return token; }
} // Auto-patch URL if needed (Optional, for backward compatibility)
window.addEventListener('load', () => { const params = new URLSearchParams(window.location.search); const id = params.get('id'); // If we have an old ID format, we could redirect to the new one, but better to just accept both.
});
