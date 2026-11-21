const fs = require("node:fs/promises");
const path = require("node:path");
const LIMIT = 100 * 1024 * 1024;
const MAX_IMAGE = 5 * 1024 * 1024;
const MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
function createOnlineImageCache(directory, limit = LIMIT) {
  const root = path.resolve(directory);
  let pending = Promise.resolve();
  const serial = (action) => {
    const result = pending.then(action);
    pending = result.catch(() => {});
    return result;
  };
  const file = (key, ext) => {
    if (!/^[a-f0-9]{64}$/.test(key)) throw new Error("Invalid image cache key.");
    return path.join(root, key + ext);
  };
  const json = async (name) => {
    try {
      return JSON.parse(await fs.readFile(name, "utf8"));
    } catch {
      return null;
    }
  };
  const writeJson = async (name, value) => {
    await fs.mkdir(root, { recursive: true });
    await fs.writeFile(name + ".pending", JSON.stringify(value));
    await fs.rename(name + ".pending", name);
  };
  const entries = async () => {
    const files = await fs.readdir(root).catch(() => []);
    const result = [];
    for (const name of files)
      if (/^[a-f0-9]{64}\.json$/.test(name)) {
        const entry = await json(path.join(root, name));
        if (
          entry &&
          /^[a-f0-9]{64}$/.test(entry.key) &&
          Number.isFinite(entry.size) &&
          entry.size >= 0
        )
          result.push(entry);
      }
    return result;
  };
  const remove = async (key) => {
    await Promise.all([
      fs.rm(file(key, ".json"), { force: true }),
      fs.rm(file(key, ".bin"), { force: true }),
    ]);
  };
  return {
    read(key) {
      return serial(async () => {
        const meta = await json(file(key, ".json"));
        if (!meta) return null;
        if (meta.size > MAX_IMAGE || meta.size < 0) {
          await remove(key);
          return null;
        }
        let bytes = null;
        if (meta.size) {
          try {
            const buffer = await fs.readFile(file(key, ".bin"));
            if (buffer.byteLength !== meta.size) throw Error("Incomplete cache");
            bytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
          } catch {
            await remove(key);
            return null;
          }
        }
        const touched = { ...meta, lastUsed: Date.now() };
        await writeJson(file(key, ".json"), touched).catch(() => {});
        const { size: _, ...record } = touched;
        return { ...record, bytes };
      });
    },
    write(record) {
      return serial(async () => {
        file(record.key, ".json");
        const bytes =
          record.bytes === null
            ? null
            : record.bytes instanceof ArrayBuffer
              ? Buffer.from(record.bytes)
              : null;
        if (record.bytes !== null && !bytes) throw Error("Invalid image bytes.");
        const size = bytes?.byteLength ?? 0;
        if (size > MAX_IMAGE || size > limit || (size && !MIMES.has(record.mime)))
          throw Error("Unsupported cached image.");
        let credit = null;
        if (size) {
          if (!record.credit) throw Error("Image attribution missing.");
          credit = {};
          for (const key of ["title", "author", "license", "licenseUrl", "sourceUrl"])
            credit[key] = String(record.credit[key] ?? "").slice(0, 1200);
          const u = new URL(credit.sourceUrl);
          if (u.protocol !== "https:" || u.hostname !== "commons.wikimedia.org")
            throw Error("Invalid image source.");
        }
        const previous = (await entries())
          .filter((v) => v.key !== record.key)
          .sort((a, b) => a.lastUsed - b.lastUsed);
        let total = previous.reduce((n, v) => n + v.size, 0) + size;
        while (previous.length && (total > limit || previous.length >= 1000)) {
          const old = previous.shift();
          total -= old.size;
          await remove(old.key);
        }
        await fs.mkdir(root, { recursive: true });
        if (bytes) {
          await fs.writeFile(file(record.key, ".bin.pending"), bytes);
          await fs.rename(file(record.key, ".bin.pending"), file(record.key, ".bin"));
        } else await fs.rm(file(record.key, ".bin"), { force: true });
        await writeJson(file(record.key, ".json"), {
          key: record.key,
          size,
          mime: size ? record.mime : "",
          credit,
          lastUsed: Date.now(),
          missingUntil: Number(record.missingUntil) || 0,
        });
      });
    },
    clear() {
      return serial(async () => {
        const names = await fs.readdir(root).catch(() => []);
        for (const name of names)
          if (/^[a-f0-9]{64}\.(?:json|bin)(?:\.pending)?$/.test(name))
            await fs.rm(path.join(root, name), { force: true });
      });
    },
    stats() {
      return serial(async () => {
        const all = await entries();
        return {
          bytes: all.reduce((n, v) => n + v.size, 0),
          count: all.filter((v) => v.size > 0).length,
        };
      });
    },
    enabled() {
      return serial(async () => (await json(path.join(root, "settings.json")))?.enabled === true);
    },
    setEnabled(value) {
      return serial(() => writeJson(path.join(root, "settings.json"), { enabled: value === true }));
    },
  };
}
module.exports = { createOnlineImageCache };
