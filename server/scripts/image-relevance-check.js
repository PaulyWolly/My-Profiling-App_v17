/**
 * Scores representative image results against a query, so the relevance filter
 * can be checked without hitting the network.
 *
 * Positive scores are kept; anything zero or below is dropped from the gallery.
 *
 *   node scripts/image-relevance-check.js
 */
const { relevanceScore } = require('../services/image-search.service');

const GROUPS = [
    {
        query: 'box jellyfish',
        keep: [
            { title: 'Box jellyfish', pageUrl: 'https://en.wikipedia.org/wiki/Box_jellyfish', url: 'box_jellyfish.jpg' },
            { title: 'Chironex fleckeri', pageUrl: 'https://commons.wikimedia.org/wiki/Chironex', url: 'chironex_fleckeri.jpg' },
            { title: 'Box jellyfish in northern Australian coastal waters', pageUrl: 'https://commons.wikimedia.org/x', url: 'nt_box_jellyfish.jpg' },
            { title: 'Avispa marina (Chironex fleckeri) en acuario', pageUrl: 'https://commons.wikimedia.org/y', url: 'aquarium.jpg' }
        ],
        drop: [
            { title: 'The Big Bang Theory cast portrait', pageUrl: 'https://x/tv', url: 'sitcom.jpg' },
            { title: 'Cardboard box on a pallet', pageUrl: 'https://x/box', url: 'cardboard.jpg' }
        ]
    },
    {
        query: 'king cobra',
        keep: [
            { title: 'Ophiophagus hannah, king cobra', pageUrl: 'https://x/kc', url: 'king_cobra.jpg' }
        ],
        drop: [
            { title: 'Naja naja, Indian cobra', pageUrl: 'https://x/naja', url: 'indian_cobra.jpg' },
            { title: 'Kings Island roller coaster ride', pageUrl: 'https://x/ride', url: 'coaster.jpg' }
        ]
    },
    {
        query: 'blue ringed octopus',
        keep: [
            { title: 'Hapalochlaena lunulata, blue-ringed octopus', pageUrl: 'https://x/bro', url: 'blue_ringed.jpg' },
            { title: 'Blue ringed octopus in shallow water', pageUrl: 'https://x/bro2', url: 'octopus.jpg' }
        ],
        drop: []
    },
    {
        query: 'ten penny nail',
        keep: [
            { title: 'Nail (fastener) common wire nails', pageUrl: 'https://x/nail', url: 'common_nail.jpg' }
        ],
        drop: [
            { title: 'Nine Inch Nails in concert', pageUrl: 'https://x/nin', url: 'nin.jpg' },
            { title: 'Manicure fingernail closeup', pageUrl: 'https://x/mani', url: 'manicure.jpg' }
        ]
    }
];

let failed = 0;

for (const group of GROUPS) {
    console.log(`\nquery: "${group.query}"`);

    for (const img of group.keep) {
        const score = relevanceScore(img, group.query);
        const ok = score > 0;
        if (!ok) failed += 1;
        console.log(`  ${ok ? 'ok  ' : 'FAIL'}  keep  ${String(score).padStart(4)}  ${img.title}`);
    }

    for (const img of group.drop) {
        const score = relevanceScore(img, group.query);
        const ok = score <= 0;
        if (!ok) failed += 1;
        console.log(`  ${ok ? 'ok  ' : 'FAIL'}  drop  ${String(score).padStart(4)}  ${img.title}`);
    }
}

const total = GROUPS.reduce((n, g) => n + g.keep.length + g.drop.length, 0);
console.log(`\n${total - failed}/${total} passed`);
process.exitCode = failed ? 1 : 0;
