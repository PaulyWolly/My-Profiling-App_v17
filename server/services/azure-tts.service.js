const fs = require('fs');
const path = require('path');
const nodeFetch = require('node-fetch');

const openaiService = require('./openai.service');

/**
 * Azure Neural text-to-speech.
 *
 * Ported from the MERN MultiChat app, whose live speech path was Azure rather
 * than OpenAI — the neural voices there are named (Andrew, Jenny, Guy…) and
 * "Andrew" is the default. Azure is preferred whenever credentials exist and the
 * caller falls back to OpenAI otherwise, so the app still speaks either way.
 */

/** Same list the MERN app offered, in the same order. */
const AZURE_VOICES = [
    { id: 'en-US-AndrewNeural', label: 'Andrew (US)' },
    { id: 'en-US-JennyNeural', label: 'Jenny (US)' },
    { id: 'en-US-GuyNeural', label: 'Guy (US)' },
    { id: 'en-US-AriaNeural', label: 'Aria (US)' },
    { id: 'en-US-DavisNeural', label: 'Davis (US)' },
    { id: 'en-GB-SoniaNeural', label: 'Sonia (UK)' },
    { id: 'en-GB-RyanNeural', label: 'Ryan (UK)' },
    { id: 'en-AU-NatashaNeural', label: 'Natasha (AU)' }
];

const DEFAULT_AZURE_VOICE = process.env.AZURE_TTS_VOICE || 'en-US-AndrewNeural';

/** MP3 keeps the response small enough to stream straight into an <audio> tag. */
const OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';

function readSecrets() {
    try {
        const configPath = path.join(__dirname, '..', 'secrets', 'config.json');
        return JSON.parse(fs.readFileSync(configPath, 'utf8')) || {};
    } catch (e) {
        return {};
    }
}

/**
 * Accepts the Node-AI names (SPEECH_*) the MERN backend used as well as the
 * clearer AZURE_SPEECH_* names, and falls back to secrets/config.json so local
 * dev matches how the OpenAI key is stored.
 */
function getCredentials() {
    const secrets = readSecrets();
    const key = (
        process.env.AZURE_SPEECH_KEY
        || process.env.SPEECH_API_KEY
        || secrets.azureSpeechKey
        || ''
    ).trim();
    const region = (
        process.env.AZURE_SPEECH_REGION
        || process.env.SPEECH_REGION
        || secrets.azureSpeechRegion
        || ''
    ).trim();
    return { key, region };
}

function isConfigured() {
    const { key, region } = getCredentials();
    return !!key && !!region && !key.includes('your-');
}

function escapeXml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/** Locale must match the voice or Azure ignores the voice and uses a default. */
function localeForVoice(voiceId) {
    const match = /^([a-z]{2}-[A-Z]{2})-/.exec(voiceId);
    return match ? match[1] : 'en-US';
}

/**
 * Renders text to MP3 audio. Resolves to the same shape as the OpenAI service so
 * the route can treat the two providers interchangeably.
 */
async function synthesizeSpeech(text, voiceId) {
    const { key, region } = getCredentials();
    if (!key || !region) {
        throw 'Azure Speech is not configured. Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (or azureSpeechKey / azureSpeechRegion in server/secrets/config.json).';
    }

    const voice = AZURE_VOICES.some((v) => v.id === voiceId) ? voiceId : DEFAULT_AZURE_VOICE;
    // Reuses the markdown flattening the OpenAI path already does, so headings
    // and list items become separate sentences instead of one run-on block.
    const input = openaiService.prepareTextForSpeech(text);

    const ssml = `<speak version="1.0" xml:lang="${localeForVoice(voice)}">`
        + `<voice name="${voice}">${escapeXml(input)}</voice>`
        + `</speak>`;

    let response;
    try {
        response = await nodeFetch(
            `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
            {
                method: 'POST',
                headers: {
                    'Ocp-Apim-Subscription-Key': key,
                    'Content-Type': 'application/ssml+xml',
                    'X-Microsoft-OutputFormat': OUTPUT_FORMAT,
                    'User-Agent': 'MyProfilingApp'
                },
                body: ssml
            }
        );
    } catch (err) {
        throw `Could not reach Azure Speech in region "${region}". ${err.message || err}`;
    }

    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        if (response.status === 401 || response.status === 403) {
            throw `Azure Speech rejected the credentials (${response.status}). Check AZURE_SPEECH_KEY and that AZURE_SPEECH_REGION matches the key's region.`;
        }
        if (response.status === 400) {
            throw `Azure Speech rejected the request (400). The voice "${voice}" may not exist in region "${region}". ${detail}`.trim();
        }
        throw `Azure Speech failed (${response.status}). ${detail}`.trim();
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return { buffer, model: `azure:${OUTPUT_FORMAT}`, voice };
}

module.exports = {
    AZURE_VOICES,
    DEFAULT_AZURE_VOICE,
    isConfigured,
    synthesizeSpeech,
    getTtsConfig: () => ({
        voices: AZURE_VOICES,
        defaultVoice: DEFAULT_AZURE_VOICE
    })
};
