import { getColor } from './utils.js';

/**
 * 게임 이름 매핑을 가져옵니다. (하위 호환용)
 * @returns {Promise<Object>}
 */
export async function fetchGames() {
    const response = await fetch('data/games.json?t=' + Date.now());
    if (!response.ok) {
        throw new Error('games.json을 로드하는 데 실패했습니다.');
    }
    const data = await response.json();
    const nameMapping = {};
    data.games.forEach(game => {
        nameMapping[game.name] = game.englishName;
    });
    return nameMapping;
}

/**
 * 플레이 시간 텍스트를 만듭니다.
 * @param {number|null} min
 * @param {number|null} max
 * @returns {string}
 */
function formatPlaytime(min, max) {
    if (!min && !max) return 'N/A';
    if (min && max) {
        return min === max ? `${min}분` : `${min} - ${max}분`;
    }
    return `${min || max}분`;
}

/**
 * 미리 계산된 stats(BGG 통계)를 테이블 행에 채워넣습니다.
 * (예전에는 BGG를 실시간 호출했지만, 이제 data/*.json 에 캐시된 값을 사용합니다.)
 * @param {HTMLElement} linkElement - .bgg-link 요소
 * @param {Object|undefined} stats - { bggId, rating, weight, minPlayers, maxPlayers, minPlaytime, maxPlaytime, bestWith, recommendedWith }
 */
export function applyStats(linkElement, stats) {
    const row = linkElement.parentElement.parentElement;
    const scoreEl = row.querySelector('.score');
    const weightEl = row.querySelector('.weight');
    const playersEl = row.querySelector('.players');
    const playtimeEl = row.querySelector('.playtime');
    const bestEl = row.querySelector('.best-players');
    const recEl = row.querySelector('.recommended-players');

    if (!stats || stats.error) {
        [scoreEl, weightEl, playersEl, playtimeEl].forEach(el => { if (el) el.textContent = 'N/A'; });
        if (bestEl) bestEl.innerHTML = 'N/A';
        if (recEl) recEl.innerHTML = 'N/A';
        row.setAttribute('data-bestwith', 'N/A');
        row.setAttribute('data-recommendedwith', 'N/A');
        if (scoreEl) scoreEl.style.color = getColor('N/A', 'score');
        if (weightEl) weightEl.style.color = getColor('N/A', 'weight');
        return;
    }

    if (stats.bggId) {
        linkElement.href = `https://boardgamegeek.com/boardgame/${stats.bggId}`;
        linkElement.setAttribute('bggId', stats.bggId);
    }

    const rating = stats.rating || 'N/A';
    const weight = stats.weight || 'N/A';
    const bestWith = stats.bestWith || 'N/A';
    const recommendedWith = stats.recommendedWith || 'N/A';

    if (scoreEl) scoreEl.textContent = rating;
    if (weightEl) weightEl.textContent = weight;
    if (playersEl) {
        playersEl.textContent = (stats.minPlayers != null && stats.maxPlayers != null)
            ? `${stats.minPlayers} - ${stats.maxPlayers}`
            : 'N/A';
    }
    if (playtimeEl) playtimeEl.textContent = formatPlaytime(stats.minPlaytime, stats.maxPlaytime);
    if (bestEl) bestEl.innerHTML = bestWith;
    if (recEl) recEl.innerHTML = recommendedWith;

    row.setAttribute('data-bestwith', bestWith);
    row.setAttribute('data-recommendedwith', recommendedWith);

    if (scoreEl) scoreEl.style.color = getColor(rating, 'score');
    if (weightEl) weightEl.style.color = getColor(weight, 'weight');
}
