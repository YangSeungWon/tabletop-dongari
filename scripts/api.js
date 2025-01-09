import { rateLimitedFetch } from './rateLimiter.js';
import { getColor } from './utils.js';

/**
 * 게임 이름 매핑을 가져옵니다.
 * @returns {Promise<Object>}
 */
export async function fetchGames() {
    const response = await fetch('data/games.json');
    if (!response.ok) {
        throw new Error('games.json을 로드하는 데 실패했습니다.');
    }
    return response.json();
}

/**
 * 로컬 스토리지에 캐시된 데이터를 가져오거나, 없으면 fetch를 수행하여 캐시에 저장한 후 반환합니다.
 * @param {string} url - 요청할 URL
 * @param {string} cacheKey - 로컬 스토리지에 저장할 키
 * @returns {Promise<Response>}
 */
export async function cachedFetch(url, cacheKey = null) {
    const key = cacheKey || url;

    // 로컬 스토리지에서 캐시된 데이터 검색
    const cached = localStorage.getItem(key);
    if (cached) {
        console.log(`캐시된 데이터를 반환합니다: ${key}`);
        // 캐시된 데이터를 Blob으로 변환하여 Response 객체 생성
        return Promise.resolve(new Response(new Blob([cached])));
    }

    try {
        // 레이트 리미팅된 fetch 사용
        const response = await rateLimitedFetch(url, {});

        if (!response.ok) {
            throw new Error(`HTTP 에러! 상태: ${response.status}`);
        }

        const data = await response.clone().text();

        try {
            localStorage.setItem(key, data);
        } catch (e) {
            console.warn('로컬 스토리지 저장 실패:', e);
        }

        return response;
    } catch (error) {
        console.error('레이트 리미팅된 fetch 에러:', error);
        throw error;
    }
}

/**
 * POST 요청을 새 창으로 엽니다.
 * @param {string} url - 요청할 URL
 * @param {object} data - 전송할 데이터
 */
export function openPostWindow(url, data) {
    // Create a form element
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = url;
    form.target = '_blank';

    // Add form fields from data object
    for (const [key, value] of Object.entries(data)) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = value;
        form.appendChild(input);
    }

    // Add form to document, submit it, and remove it
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
}

/**
 * 게임 데이터를 가져옵니다.
 * @param {string} koreanName - 한국어 게임 이름
 * @param {string} englishName - 영어 게임 이름
 * @param {HTMLElement} linkElement - 링크 요소
 * @returns {Promise<void>}
 */
export async function fetchGameData(koreanName, englishName, linkElement) {
    const hosts = ['boardgamegeek.com', 'rpggeek.com', 'videogamegeek.com'];
    const host = hosts[Math.floor(Math.random() * hosts.length)];
    const apiUrl = `https://${host}/xmlapi2/search?query=${encodeURIComponent(englishName)}&type=boardgame`;
    const cacheKey = `search_${englishName.toLowerCase()}`;

    return cachedFetch(apiUrl, cacheKey)
        .then(response => response.text())
        .then(str => (new window.DOMParser()).parseFromString(str, "text/xml"))
        .then(data => {
            const items = data.querySelectorAll('item');
            let item;
            if (items.length === 1) {
                item = items[0];
            } else {
                const matchingItems = Array.from(items)
                    .filter(item => item.querySelector('name').getAttribute('value').toLowerCase() === englishName.toLowerCase())
                    .sort((a, b) => {
                        if (!a.querySelector('yearpublished')) {
                            return 1;
                        }
                        if (!b.querySelector('yearpublished')) {
                            return -1;
                        }
                        const yearA = parseInt(a.querySelector('yearpublished').getAttribute('value') || '0');
                        const yearB = parseInt(b.querySelector('yearpublished').getAttribute('value') || '0');
                        return yearB - yearA;
                    });
                item = matchingItems[0];
            }
            if (!item) {
                const filterWords = ['promo'];
                const itemsFiltered = Array.from(items).filter(item => !filterWords.some(word => item.querySelector('name').getAttribute('value').toLowerCase().includes(word.toLowerCase())));
                item = itemsFiltered[0];
            }
            if (item) {
                const id = item.getAttribute('id');
                const gameUrl = `https://boardgamegeek.com/boardgame/${id}`;
                linkElement.href = gameUrl;
                linkElement.setAttribute('bggId', id);

                // 상세 게임 데이터 가져오기 (캐싱 적용)
                return fetchGameDetails(id, linkElement);
            } else {
                console.warn(`게임을 찾을 수 없습니다: ${englishName}`);
                console.warn(`${koreanName} 게임의 영어이름이 제대로 설정되지 않았습니다. 새탭으로 보드라이프 검색 페이지를 엽니다.`);
                const boardlifeUrl = `https://boardlife.co.kr/search_ajax.php`;
                const boardlifeData = {
                    action: "CallPage",
                    query: koreanName,
                    page: "game"
                };
                openPostWindow(boardlifeUrl, boardlifeData);
                linkElement.parentElement.parentElement.querySelector('.score').textContent = 'N/A';
                linkElement.parentElement.parentElement.querySelector('.weight').textContent = 'N/A';
                throw new Error('게임을 찾을 수 없습니다.');
            }
        })
        .catch(error => {
            console.error('보드게임 데이터 가져오기 에러:', error);
            linkElement.parentElement.parentElement.querySelector('.score').textContent = 'Error';
            linkElement.parentElement.parentElement.querySelector('.weight').textContent = 'Error';
            return Promise.reject('Error');
        });
}

/**
 * 상세 게임 데이터를 가져옵니다.
 * @param {string} gameId - 게임 ID
 * @param {HTMLElement} linkElement - 링크 요소
 * @returns {Promise<Array<string | number>>}
 */
export async function fetchGameDetails(gameId, linkElement) {
    const detailsUrl = `https://www.boardgamegeek.com/xmlapi2/thing?id=${gameId}&stats=1`;
    const cacheKey = `game_details_${gameId}`;

    return cachedFetch(detailsUrl, cacheKey)
        .then(response => response.text())
        .then(str => (new window.DOMParser()).parseFromString(str, "text/xml"))
        .then(data => {
            const average = data.querySelector('average').getAttribute('value');
            const averageweight = data.querySelector('averageweight').getAttribute('value');
            const minPlayers = data.querySelector('minplayers').getAttribute('value');
            const maxPlayers = data.querySelector('maxplayers').getAttribute('value');
            const minPlaytime = data.querySelector('minplaytime').getAttribute('value');
            const maxPlaytime = data.querySelector('maxplaytime').getAttribute('value');
            const description = data.querySelector('description').textContent.trim();

            const rating = average ? parseFloat(average).toFixed(2) : 'N/A';
            const weight = averageweight ? parseFloat(averageweight).toFixed(2) : 'N/A';
            const playtime = minPlaytime && maxPlaytime ? (minPlaytime === maxPlaytime ? `${minPlaytime}분` : `${minPlaytime} - ${maxPlaytime}분`) : 'N/A';

            // Extract suggested_numplayers
            const pollSummary = data.querySelector('poll-summary[name="suggested_numplayers"]');
            let bestWith = 'N/A';
            let recommendedWith = 'N/A';

            if (pollSummary) {
                const bestWithResult = pollSummary.querySelector('result[name="bestwith"]');
                const recommendedWithResult = pollSummary.querySelector('result[name="recommendedwith"], result[name="recommmendedwith"]'); // Handling typo

                if (bestWithResult) {
                    try {
                        bestWith = bestWithResult.getAttribute('value').split('with ')[1].split(' players')[0];
                    } catch (e) {
                        console.warn('bestWith 추출 에러:', e, bestWithResult.getAttribute('value'));
                        bestWith = 'N/A';
                    }
                }

                if (recommendedWithResult) {
                    try {
                        recommendedWith = recommendedWithResult.getAttribute('value').split('with ')[1].split(' players')[0];
                    } catch (e) {
                        console.warn('recommendedWith 추출 에러:', e, recommendedWithResult.getAttribute('value'));
                        recommendedWith = 'N/A';
                    }
                }
            }

            // Update UI elements
            linkElement.parentElement.parentElement.querySelector('.score').textContent = rating;
            linkElement.parentElement.parentElement.querySelector('.weight').textContent = weight;
            linkElement.parentElement.parentElement.querySelector('.players').textContent = `${minPlayers} - ${maxPlayers}`;
            linkElement.parentElement.parentElement.querySelector('.playtime').textContent = playtime;

            // Store bestWith and recommendedWith as data attributes on the <tr>
            const listItem = linkElement.parentElement.parentElement;
            listItem.setAttribute('data-bestwith', bestWith);
            listItem.setAttribute('data-recommendedwith', recommendedWith);

            // Optionally, display suggested player counts
            const bestPlayersElement = listItem.querySelector('.best-players');
            bestPlayersElement.innerHTML = bestWith;
            const recommendedPlayersElement = listItem.querySelector('.recommended-players');
            recommendedPlayersElement.innerHTML = recommendedWith;

            // Set text colors based on values
            const scoreElement = listItem.querySelector('.score');
            const weightElement = listItem.querySelector('.weight');
            scoreElement.style.color = getColor(rating, 'score');
            weightElement.style.color = getColor(weight, 'weight');

            return Promise.resolve([rating, weight]);
        })
        .catch(error => {
            console.error('게임 상세 데이터 에러:', error);
            linkElement.parentElement.parentElement.querySelector('.score').textContent = 'Error';
            linkElement.parentElement.parentElement.querySelector('.weight').textContent = 'Error';
            return Promise.reject('Error');
        });
}
