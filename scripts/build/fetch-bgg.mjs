// BGG XML API에서 게임 통계를 서버측에서 가져와 data/*.json 의 stats 필드에 채워넣습니다.
//
// BGG는 2025-07 정책 변경으로 XML API에 등록/인증(Bearer 토큰)을 요구하며,
// 브라우저에서의 직접 호출을 금지(권장하지 않음)합니다. 따라서 이 스크립트는
// GitHub Actions 등 서버 환경에서 실행되어 결과를 JSON에 미리 캐시하고,
// 프론트엔드는 BGG를 호출하지 않고 그 JSON만 읽습니다.
//
// 실행: BGG_TOKEN=<발급받은 토큰> node scripts/build/fetch-bgg.mjs
// 참고: https://boardgamegeek.com/using_the_xml_api

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'data');

// BGG 도메인은 반드시 www 없이 boardgamegeek.com 사용 (문서 명시)
const BASE = 'https://boardgamegeek.com/xmlapi2';
const TOKEN = process.env.BGG_TOKEN;

// 요청 간 최소 간격(ms). BGG는 요청 최소화를 요구하므로 넉넉하게 둔다.
const REQUEST_INTERVAL = 2500;
const MAX_RETRIES = 4;
const MAX_CANDIDATES = 5; // weight가 0이면 다음 검색 후보를 시도하는 최대 횟수

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let lastRequestAt = 0;

/**
 * 레이트 리밋을 지키며 BGG에 요청하고 XML 문자열을 반환합니다.
 * 202(큐 대기), 429(레이트 리밋), 5xx는 백오프 후 재시도합니다.
 */
async function bggFetch(url) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const wait = REQUEST_INTERVAL - (Date.now() - lastRequestAt);
        if (wait > 0) await sleep(wait);
        lastRequestAt = Date.now();

        let res;
        try {
            res = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${TOKEN}`,
                    Accept: 'text/xml',
                    'User-Agent': 'tabletop-dongari/1.0 (+https://github.com)',
                },
            });
        } catch (err) {
            if (attempt === MAX_RETRIES) throw err;
            await sleep(2000 * 2 ** attempt);
            continue;
        }

        if (res.status === 401 || res.status === 403) {
            const body = await res.text().catch(() => '');
            throw new Error(
                `인증 실패(${res.status}). BGG_TOKEN 이 올바른지, 앱이 승인되었는지 확인하세요. 응답: ${body.slice(0, 200)}`
            );
        }

        // 202: BGG가 요청을 큐에 넣음 → 잠시 후 재시도. 429/5xx도 재시도.
        if (res.status === 202 || res.status === 429 || res.status >= 500) {
            if (attempt === MAX_RETRIES) {
                throw new Error(`요청 실패(${res.status}) 최대 재시도 초과: ${url}`);
            }
            await sleep(2000 * 2 ** attempt);
            continue;
        }

        if (!res.ok) {
            throw new Error(`요청 실패(${res.status}): ${url}`);
        }

        return res.text();
    }
    throw new Error(`요청 실패(재시도 초과): ${url}`);
}

// --- 아주 작은 XML 파서 (필요한 속성만 정규식으로 추출) ---

function decodeEntities(s) {
    return s
        // 숫자 참조 먼저 (예: &#8211; → –). checkPlayerCount는 en-dash(–)를 구분자로 씀.
        .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
        .replace(/&ndash;/g, '–')
        .replace(/&mdash;/g, '—')
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&'); // &amp; 는 마지막에 (이중 디코딩 방지)
}

function attr(xml, tag, name = 'value') {
    const m = xml.match(new RegExp(`<${tag}\\b[^>]*\\b${name}="([^"]*)"`));
    return m ? decodeEntities(m[1]) : null;
}

/** search 응답에서 후보 목록 [{ id, name, year }] 을 반환 */
function parseSearchItems(xml) {
    const items = [];
    const re = /<item\b[^>]*\bid="(\d+)"[^>]*>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
        const id = m[1];
        const inner = m[2];
        const nameMatch = inner.match(/<name\b[^>]*\bvalue="([^"]*)"/);
        const yearMatch = inner.match(/<yearpublished\b[^>]*\bvalue="([^"]*)"/);
        items.push({
            id,
            name: nameMatch ? decodeEntities(nameMatch[1]) : '',
            year: yearMatch ? parseInt(yearMatch[1], 10) || 0 : 0,
        });
    }
    return items;
}

/** thing 응답(stats=1)에서 필요한 통계를 추출 */
function parseThing(xml) {
    // 여러 item 이 올 수 있으나 단일 id 조회이므로 첫 item 만.
    const itemMatch = xml.match(/<item\b[\s\S]*?<\/item>/);
    const item = itemMatch ? itemMatch[0] : xml;

    const average = attr(item, 'average');
    const averageweight = attr(item, 'averageweight');
    const minPlayers = attr(item, 'minplayers');
    const maxPlayers = attr(item, 'maxplayers');
    const minPlaytime = attr(item, 'minplaytime');
    const maxPlaytime = attr(item, 'maxplaytime');

    let bestWith = 'N/A';
    let recommendedWith = 'N/A';
    const pollMatch = item.match(
        /<poll-summary\b[^>]*name="suggested_numplayers"[^>]*>([\s\S]*?)<\/poll-summary>/
    );
    if (pollMatch) {
        const poll = pollMatch[1];
        const best = poll.match(/<result\b[^>]*name="bestwith"[^>]*value="([^"]*)"/);
        // BGG는 이 필드에 오타("recommmendedwith", m 3개)를 쓰기도 하므로 m 1~3개 모두 허용
        const rec = poll.match(/<result\b[^>]*name="recom+endedwith"[^>]*value="([^"]*)"/);
        if (best) {
            try {
                bestWith = decodeEntities(best[1]).split('with ')[1].split(' players')[0];
            } catch { /* keep N/A */ }
        }
        if (rec) {
            try {
                recommendedWith = decodeEntities(rec[1]).split('with ')[1].split(' players')[0];
            } catch { /* keep N/A */ }
        }
    }

    const rating = average ? parseFloat(average).toFixed(2) : 'N/A';
    const weight = averageweight ? parseFloat(averageweight).toFixed(2) : 'N/A';

    return {
        rating,
        weight,
        minPlayers: minPlayers ? parseInt(minPlayers, 10) : null,
        maxPlayers: maxPlayers ? parseInt(maxPlayers, 10) : null,
        minPlaytime: minPlaytime ? parseInt(minPlaytime, 10) : null,
        maxPlaytime: maxPlaytime ? parseInt(maxPlaytime, 10) : null,
        bestWith,
        recommendedWith,
    };
}

const emptyWeight = (w) => !w || w === '0.00' || w === '0.0' || w === '0' || w === 'N/A';

/** id로 상세 통계를 가져온다 */
async function fetchDetails(id) {
    const xml = await bggFetch(`${BASE}/thing?id=${id}&stats=1`);
    return parseThing(xml);
}

/** 영문 이름으로 검색 → 가장 알맞은 후보를 골라 통계까지 확보 */
async function resolveByName(englishName) {
    const xml = await bggFetch(
        `${BASE}/search?query=${encodeURIComponent(englishName)}&type=boardgame`
    );
    const items = parseSearchItems(xml);
    if (items.length === 0) return null;

    // 이름이 정확히 일치하는 후보를 연도 내림차순으로 우선.
    const lower = englishName.toLowerCase();
    const exact = items
        .filter((it) => it.name.toLowerCase() === lower)
        .sort((a, b) => b.year - a.year);
    const ordered = exact.length ? [...exact, ...items.filter((it) => !exact.includes(it))] : items;

    const tried = new Set();
    for (const cand of ordered) {
        if (tried.size >= MAX_CANDIDATES) break;
        if (tried.has(cand.id)) continue;
        tried.add(cand.id);
        const stats = await fetchDetails(cand.id);
        if (!emptyWeight(stats.weight)) {
            return { id: cand.id, stats };
        }
    }
    // weight가 전부 0이면 첫 후보라도 반환
    const first = ordered[0];
    return { id: first.id, stats: await fetchDetails(first.id) };
}

/**
 * 한 게임의 stats를 갱신. bggId 힌트(기존 stats.bggId 또는 name의 "이름|id")가 있으면
 * 검색을 건너뛰고 thing만 호출한다.
 * @returns {Promise<object>} 갱신된 stats
 */
async function updateGameStats({ englishName, name, existing }) {
    let bggId = existing?.bggId || null;
    if (!bggId && typeof name === 'string' && name.includes('|')) {
        bggId = name.split('|')[1];
    }

    if (bggId) {
        const stats = await fetchDetails(bggId);
        return { bggId: String(bggId), ...stats, updatedAt: today() };
    }

    if (!englishName) {
        console.warn(`  영문 이름이 없어 건너뜀: ${name}`);
        return { ...(existing || {}), error: 'no-english-name', updatedAt: today() };
    }

    const resolved = await resolveByName(englishName);
    if (!resolved) {
        console.warn(`  BGG에서 찾지 못함: ${englishName}`);
        return { ...(existing || {}), error: 'not-found', updatedAt: today() };
    }
    return { bggId: String(resolved.id), ...resolved.stats, updatedAt: today() };
}

// updatedAt 은 실행 시각 기준. (테스트 재현성보다 사람이 읽는 용도)
function today() {
    return new Date().toISOString().slice(0, 10);
}

async function readJson(name) {
    return JSON.parse(await readFile(join(DATA_DIR, name), 'utf8'));
}

async function writeJson(name, obj) {
    await writeFile(join(DATA_DIR, name), JSON.stringify(obj, null, 4) + '\n', 'utf8');
}

async function main() {
    if (!TOKEN) {
        console.error('오류: 환경변수 BGG_TOKEN 이 설정되지 않았습니다.');
        process.exit(1);
    }

    const onlyChanged = process.argv.includes('--only-missing');

    // --- games.json ---
    const gamesData = await readJson('games.json');
    console.log(`games.json: ${gamesData.games.length}개 게임`);
    for (const game of gamesData.games) {
        if (onlyChanged && game.stats && !game.stats.error) {
            continue; // 이미 채워진 건 건너뜀
        }
        try {
            console.log(`- ${game.name} (${game.englishName})`);
            game.stats = await updateGameStats({
                englishName: game.englishName,
                name: game.name,
                existing: game.stats,
            });
        } catch (err) {
            console.error(`  실패: ${game.name}:`, err.message);
            game.stats = { ...(game.stats || {}), error: 'fetch-failed', updatedAt: today() };
        }
    }
    await writeJson('games.json', gamesData);
    console.log('games.json 갱신 완료');

    // --- wishlist.json (koreanName -> { englishName, reason, stats }) ---
    const wishlist = await readJson('wishlist.json');
    const names = Object.keys(wishlist);
    console.log(`wishlist.json: ${names.length}개`);
    for (const koreanName of names) {
        const entry = wishlist[koreanName];
        if (onlyChanged && entry.stats && !entry.stats.error) continue;
        try {
            console.log(`- ${koreanName} (${entry.englishName})`);
            entry.stats = await updateGameStats({
                englishName: entry.englishName,
                name: koreanName,
                existing: entry.stats,
            });
        } catch (err) {
            console.error(`  실패: ${koreanName}:`, err.message);
            entry.stats = { ...(entry.stats || {}), error: 'fetch-failed', updatedAt: today() };
        }
    }
    await writeJson('wishlist.json', wishlist);
    console.log('wishlist.json 갱신 완료');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
