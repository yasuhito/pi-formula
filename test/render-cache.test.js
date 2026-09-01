const assert = require("node:assert/strict");
const test = require("node:test");

const { RenderCache } = require("../dist/render-cache.js");

function image(scale, bytes = 10000) {
  return {
    svg: "s".repeat(bytes),
    png: Buffer.alloc(bytes),
    scale,
    widthPx: 1,
    heightPx: 1,
    columns: 1,
    rows: 1,
  };
}

test("a rejected scaled image keeps only a lightweight cache entry", () => {
  const cache = new RenderCache(4);
  let creates = 0;
  const create = () => {
    creates += 1;
    return image(0.49);
  };

  assert.deepEqual(
    {
      first: cache.getOrCreate(
        "too-small",
        create,
        (value) => value.scale >= 0.5,
      ),
      second: cache.getOrCreate(
        "too-small",
        create,
        (value) => value.scale >= 0.5,
      ),
      creates,
      stats: cache.stats(),
    },
    {
      first: undefined,
      second: undefined,
      creates: 1,
      stats: {
        entries: 1,
        bytes: Buffer.byteLength("too-small"),
        lastFailure: "image would be too small",
      },
    },
  );
});

test("an accepted image is reused with its image bytes", () => {
  const cache = new RenderCache(4);
  let creates = 0;
  const create = () => {
    creates += 1;
    return image(0.5, 20);
  };

  const first = cache.getOrCreate(
    "readable",
    create,
    (value) => value.scale >= 0.5,
  );
  const second = cache.getOrCreate(
    "readable",
    create,
    (value) => value.scale >= 0.5,
  );

  assert.deepEqual(
    { sameImage: first === second, creates, stats: cache.stats() },
    {
      sameImage: true,
      creates: 1,
      stats: { entries: 1, bytes: Buffer.byteLength("readable") + 40 },
    },
  );
});

test("entry and byte limits evict the least recently used image", () => {
  const cache = new RenderCache(2, 90);
  const creates = new Map();
  const get = (key) =>
    cache.getOrCreate(key, () => {
      creates.set(key, (creates.get(key) ?? 0) + 1);
      return image(1, 20);
    });

  get("a");
  get("b");
  get("b");
  get("c");
  get("a");

  assert.deepEqual(
    {
      creates: Object.fromEntries(creates),
      stats: cache.stats(),
    },
    {
      creates: { a: 2, b: 1, c: 1 },
      stats: { entries: 2, bytes: 82 },
    },
  );
});

test("a failed image creation is called once for the same key", () => {
  const cache = new RenderCache(4, 100);
  let creates = 0;
  const create = () => {
    creates += 1;
    throw new Error("invalid LaTeX");
  };

  cache.getOrCreate("invalid", create);
  cache.getOrCreate("invalid", create);

  assert.deepEqual(
    { creates, stats: cache.stats() },
    {
      creates: 1,
      stats: {
        entries: 1,
        bytes: Buffer.byteLength("invalid"),
        lastFailure: "typesetting failed",
      },
    },
  );
});
