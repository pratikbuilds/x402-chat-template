const { sha256 } = require("@noble/hashes/sha2.js");
const { bytesToHex } = require("@noble/hashes/utils.js");

function toBytes(data) {
  if (typeof data === "string") {
    return new TextEncoder().encode(data);
  }
  if (data instanceof Uint8Array) {
    return data;
  }
  return new Uint8Array(data);
}

function createHash(algorithm) {
  if (String(algorithm).toLowerCase() !== "sha256") {
    throw new Error(`Unsupported hash algorithm: ${algorithm}`);
  }

  const chunks = [];
  return {
    update(data) {
      chunks.push(toBytes(data));
      return this;
    },
    digest(encoding) {
      let length = 0;
      for (const chunk of chunks) {
        length += chunk.byteLength;
      }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      const hash = sha256(bytes);
      if (!encoding) {
        return hash;
      }
      if (encoding === "hex") {
        return bytesToHex(hash);
      }
      if (encoding === "base64" || encoding === "base64url") {
        let binary = "";
        for (const value of hash) {
          binary += String.fromCharCode(value);
        }
        const base64 = globalThis.btoa(binary);
        if (encoding === "base64url") {
          return base64.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
        }
        return base64;
      }
      return hash;
    },
  };
}

module.exports = { createHash };
