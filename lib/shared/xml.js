// Values that land in ITN/confirmation XML text nodes are caller- or
// bank-supplied — escape on the way out, unescape on the way back in, so a
// value containing &, <, >, " or ' can't break element structure or forge a
// sibling tag. Hashing always runs on the raw, unescaped values (matches the
// documented field order); this is purely a serialization concern.
function escapeXml(v) {
  return String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

function unescapeXml(v) {
  return String(v).replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e]));
}

// Minimal, dependency-free tag extraction — good enough for the fixed,
// documented ITN shape. If Autopay ever sends attributes/namespaces this
// will need a real XML parser instead.
function tag(name, xml) {
  const m = xml.match(new RegExp(`<${name}>([^<]*)</${name}>`));
  return m ? unescapeXml(m[1]) : '';
}

module.exports = { escapeXml, unescapeXml, tag };
