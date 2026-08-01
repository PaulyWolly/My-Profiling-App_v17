/**
 * Measures peak memory while resizing an oversized upload.
 *
 * Render's Free and Starter instances cap at 512MB. Resizing happens in libvips,
 * outside the V8 heap, so --max-old-space-size does not bound it and an overrun
 * shows up as the platform killing the process rather than as a Node error. This
 * pushes an upload at the configured ceiling through the same sharp pipeline the
 * vision path uses and reports the peak resident size against that budget.
 *
 *   node scripts/memory-headroom-check.js
 *   node scripts/memory-headroom-check.js --mb 100 --budget 2048
 */
const sharp = require('sharp');

const args = process.argv.slice(2);
function arg(name, fallback) {
    const i = args.indexOf(`--${name}`);
    return i === -1 ? fallback : Number(args[i + 1]);
}

/** Defaults mirror AI_IMAGE_MAX_UPLOAD_MB and a Free/Starter instance. */
const TARGET_MB = arg('mb', Number(process.env.AI_IMAGE_MAX_UPLOAD_MB || 50));
const BUDGET_MB = arg('budget', 512);

/** Matches fitImageForVision in openai.service.js. */
const VISION_MAX_EDGE = 2048;

const mb = (bytes) => bytes / (1024 * 1024);
const fmt = (bytes) => `${mb(bytes).toFixed(0)} MB`;

let peakRss = 0;
function sampleRss() {
    const { rss } = process.memoryUsage();
    if (rss > peakRss) peakRss = rss;
}

/**
 * Noise barely compresses, so this reliably reaches the target size. Built in
 * horizontal bands to keep the generator itself from dominating the measurement.
 */
async function uploadOfSize(targetBytes) {
    // 3 bytes per pixel, and PNG-compressed noise lands near its raw size.
    const pixels = Math.ceil(targetBytes / 3);
    const width = Math.ceil(Math.sqrt(pixels * 1.33));
    const height = Math.ceil(pixels / width);

    const raw = Buffer.allocUnsafe(width * height * 3);
    for (let i = 0; i < raw.length; i += 1) {
        raw[i] = Math.floor(Math.random() * 256);
    }
    const buf = await sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
    return { buf, width, height };
}

(async () => {
    const timer = setInterval(sampleRss, 10);
    const baseline = process.memoryUsage().rss;

    console.log(`budget            ${BUDGET_MB} MB instance`);
    console.log(`baseline rss      ${fmt(baseline)} (node + sharp loaded)\n`);

    console.log(`building a ${TARGET_MB} MB upload...`);
    const { buf, width, height } = await uploadOfSize(TARGET_MB * 1024 * 1024);
    console.log(`  upload          ${fmt(buf.length)} (${width}x${height})`);

    // Release the generator's peak before measuring the resize itself.
    if (global.gc) global.gc();
    peakRss = process.memoryUsage().rss;
    const beforeResize = peakRss;

    const started = Date.now();
    const out = await sharp(buf, { failOn: 'none' })
        .rotate()
        .resize({ width: VISION_MAX_EDGE, height: VISION_MAX_EDGE, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
    const elapsed = Date.now() - started;
    sampleRss();

    // The resized image is base64'd into a data URL next, which is where the
    // request path allocates again.
    const dataUrl = `data:image/jpeg;base64,${out.toString('base64')}`;
    sampleRss();
    clearInterval(timer);

    console.log(`  resized         ${fmt(out.length)} in ${elapsed}ms`);
    console.log(`  as data url     ${fmt(dataUrl.length)}\n`);

    console.log(`peak rss          ${fmt(peakRss)}`);
    console.log(`resize cost       ${fmt(peakRss - beforeResize)} above pre-resize`);

    const headroom = BUDGET_MB - mb(peakRss);
    console.log(`headroom          ${headroom.toFixed(0)} MB of ${BUDGET_MB} MB\n`);

    // One request was measured. A server handling two at once pays it twice,
    // and the rest of the app needs room alongside it.
    if (headroom < 0) {
        console.log(`EXCEEDS the ${BUDGET_MB} MB budget — a single upload would be killed.`);
        process.exitCode = 1;
    } else if (headroom < mb(peakRss - beforeResize)) {
        console.log(`TIGHT — fits once, but two concurrent uploads would not.`);
        process.exitCode = 1;
    } else {
        console.log(`OK — room for this upload and a concurrent one.`);
    }
})();
