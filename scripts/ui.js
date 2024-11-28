import { fetchGameData, fetchGameDetails, openPostWindow } from './api.js';
import { parsePlaytime, checkPlayerCount, getColor } from './utils.js';
import { fetchMeetings } from './logs.js';

/**
 * 게임 리스트를 초기화합니다.
 * @param {Object} nameMapping
 */
export function initializeGameList(nameMapping) {
    const gameList = document.getElementById('game-list');
    let initialOrder = 0;

    for (const [koreanName, englishName] of Object.entries(nameMapping)) {
        let processedKoreanName = koreanName;
        let bggId = null;
        if (koreanName.includes('|')) {
            [processedKoreanName, bggId] = koreanName.split('|');
        }
        const tr = document.createElement('tr');
        tr.setAttribute('data-order', initialOrder++); // 초기 순서 저장
        tr.innerHTML = `
            <td><a href="#" target="_blank" class="bgg-link" englishName="${englishName}" ${bggId ? `bggId="${bggId}"` : ''}>
                ${processedKoreanName}
            </a></td>
            <td class="score">...</td>
            <td class="weight">...</td>
            <td class="best-players">...</td>
            <td class="recommended-players">...</td>
            <td class="players">...</td>
            <td class="playtime">...</td>
            <td class="last-played"></td>
        `;
        gameList.appendChild(tr);
    }

    const links = document.querySelectorAll('.bgg-link');
    const promises = Array.from(links).map(async link => {
        const koreanName = link.textContent.trim();
        const englishName = link.getAttribute('englishName');
        const bggId = link.getAttribute('bggId');
        if (bggId != null) {
            const gameUrl = `https://boardgamegeek.com/boardgame/${bggId}`;
            link.href = gameUrl;

            // 상세 게임 데이터 가져오기
            await fetchGameDetails(bggId, link);
            return;
        }
        
        if (englishName) {
            await fetchGameData(koreanName, englishName, link);
        } else {
            console.warn(`영어 이름을 찾을 수 없습니다: ${koreanName}`);
            // 영어 이름이 없는 경우 보드라이프 검색 페이지로 이동
            const boardlifeUrl = `https://boardlife.co.kr/search_ajax.php`;
            const boardlifeData = {
                action: "CallPage",
                query: koreanName,      
                page: "game"
            };
            openPostWindow(boardlifeUrl, boardlifeData);
        }
    });

    initializeRecentPlayed();

    Promise.all(promises).then(() => {
        console.log('모든 게임 데이터를 성공적으로 로드했습니다.');

        // 초기 상태는 난이도 기준 오름차순 정렬
        sortGamesByScore('desc');
        sortGamesByWeight('asc');
    }).catch(error => {
        console.error('게임 데이터 로드 중 에러 발생:', error);
    });
}

function initializeRecentPlayed() {
    // meetings.json 로드해서 최근 플레이 날짜 불러오기
    fetchMeetings()
        .then(meetings => {
            const gameList = document.getElementById('game-list');

            meetings.forEach(meeting => {
                const gameNames = meeting.games;
                const lastPlayed = meeting.date;
                const games = Array.from(gameList.querySelectorAll('tr'));
                gameNames.forEach(gameName => {
                    const game = games.find(game => game.querySelector('td:first-child').textContent.trim() === gameName);
                    if (game) {
                        game.querySelector('.last-played').textContent = lastPlayed;
                    }
                });
            });
        })
        .catch(error => {
            console.error('meetings.json 로드 중 에러 발생:', error);
        });
}

/**
 * 이벤트 리스너들을 초기화합니다.
 */
export function initializeEventListeners() {
    const scoreSortButton = document.getElementById('score-sort-button');
    const weightSortButton = document.getElementById('weight-sort-button');
    const resetButton = document.getElementById('reset-button');
    const playerCountInput = document.getElementById('player-count');
    const nameSortButton = document.getElementById('name-sort-button');
    const playtimeSortButton = document.getElementById('playtime-sort-button');
    const dateSortButton = document.getElementById('date-sort-button');

    // 정렬 버튼 이벤트 리스너
    scoreSortButton.addEventListener('click', () => {
        console.log('스코어 기준 정렬 버튼 클릭됨.');
        sortGamesByScore();
    });
    weightSortButton.addEventListener('click', () => {
        console.log('난이도 기준 정렬 버튼 클릭됨.');
        sortGamesByWeight();
    });

    // 필터 기능 이벤트 리스너
    playerCountInput.addEventListener('input', handlePlayerCountInput);
    resetButton.addEventListener('click', handleReset);

    // 추가 정렬 버튼 이벤트 리스너
    nameSortButton.addEventListener('click', () => {
        console.log('게임 이름 기준 정렬 버튼 클릭됨.');
        sortGamesByName();
    });
    playtimeSortButton.addEventListener('click', () => {
        console.log('플레이 시간 기준 정렬 버튼 클릭됨.');
        sortGamesByPlaytime();
    });
    dateSortButton.addEventListener('click', () => {
        console.log('최근 플레이 날짜 기준 정렬 버튼 클릭됨.');
        sortGamesByDate();
    });
}

/**
 * 플레이어 수 입력 처리
 */
function handlePlayerCountInput() {
    const playerCountInput = document.getElementById('player-count');
    const playerCount = parseInt(playerCountInput.value, 10);
    const gameList = document.getElementById('game-list');
    const games = Array.from(gameList.querySelectorAll('tr'));
    let visibleCount = 0;
    const totalGames = games.length;
    const filterStatus = document.getElementById('filter-status'); // 필터 상태 메시지 요소

    // Prevent non-numeric input
    if (playerCount !== parseInt(playerCountInput.value, 10)) {
        playerCountInput.value = playerCount;
    }

    if (isNaN(playerCount) || playerCount < 1) {
        // Invalid input: Show all games and reset filter status
        games.forEach(game => {
            game.style.display = '';
        });
        filterStatus.textContent = '';
        filterStatus.style.display = 'none';
        return;
    }

    // Filter games based on player count
    const filteredGames = games.filter(game => {
        const playersText = game.querySelector('.players').textContent;
        const [gameMin, gameMax] = playersText.split(' - ').map(num => parseInt(num, 10));

        // Check if playerCount is within the game's player range
        const isVisible = playerCount >= gameMin && playerCount <= gameMax;
        if (isVisible) {
            visibleCount++;
        }
        game.style.display = isVisible ? '' : 'none';
        return isVisible;
    });

    // Sort the filtered games based on priority
    filteredGames.sort((a, b) => {
        const aBest = checkPlayerCount(playerCount, a.getAttribute('data-bestwith'));
        const bBest = checkPlayerCount(playerCount, b.getAttribute('data-bestwith'));

        if (aBest && !bBest) return -1;
        if (!aBest && bBest) return 1;

        const aRecommended = checkPlayerCount(playerCount, a.getAttribute('data-recommendedwith'));
        const bRecommended = checkPlayerCount(playerCount, b.getAttribute('data-recommendedwith'));
        if (aRecommended && !bRecommended) return -1;
        if (!aRecommended && bRecommended) return 1;

        // 우선순위가 동일한 경우 초기 순서 기준
        const aOrder = parseInt(a.getAttribute('data-order'), 10);
        const bOrder = parseInt(b.getAttribute('data-order'), 10);
        return aOrder - bOrder;
    });

    // Re-append the sorted games to the list and apply visual styles
    filteredGames.forEach(game => {
        // Reset any existing highlight classes
        game.classList.remove('best-count', 'recommended-count', 'not-recommended');

        // Add highlight classes based on player count match
        if (checkPlayerCount(playerCount, game.getAttribute('data-bestwith'))) {
            game.classList.add('best-count');
        } else if (checkPlayerCount(playerCount, game.getAttribute('data-recommendedwith'))) {
            game.classList.add('recommended-count');
        } else {
            game.classList.add('not-recommended');
        }
        
        gameList.appendChild(game);
    });

    // Update filter status message
    filterStatus.textContent = `플레이어 수 ${playerCount}명에 맞는 게임 ${visibleCount}/${totalGames}개가 표시됩니다.`;
    filterStatus.style.display = 'block';

    // add animation
    gameList.classList.add('sorting');
    setTimeout(() => {
        gameList.classList.remove('sorting');
    }, 500);
}

/**
 * 리셋 버튼 처리
 */
function handleReset() {
    const playerCountInput = document.getElementById('player-count');
    const gameList = document.getElementById('game-list');
    const filterStatus = document.getElementById('filter-status'); // 필터 상태 메시지 요소

    // 필터 입력 초기화
    playerCountInput.value = '';
    
    // 모든 게임 표시
    const games = gameList.querySelectorAll('tr');
    games.forEach(game => {
        game.style.display = '';
    });

    // 필터 상태 메시지 초기화
    filterStatus.textContent = '';
    filterStatus.style.display = 'none';

    // 게임 리스트 element들의 class 초기화
    const gameListItems = gameList.querySelectorAll('tr');
    gameListItems.forEach(item => {
        item.classList.remove('best-count', 'recommended-count', 'not-recommended');
    });

    sortGamesByScore('desc');
    sortGamesByWeight('asc');
}

/**
 * 게임을 소트하는 일반 함수
 * @param {HTMLElement} sortButton - 소트 버튼
 * @param {string} selector - 소트 기준 셀렉터
 * @param {string|null} forceTo - 강제 정렬 방향 ('asc' 또는 'desc')
 */
function sortGames(sortButton, selector, forceTo = null) {
    const order = forceTo ? forceTo : sortButton.classList.contains('desc') ? 'asc' : 'desc';
    const previousOrder = sortButton.classList.contains('desc') ? 'desc' : 'asc';
    const switchOrder = previousOrder !== order;
    const gameLists = document.getElementById('game-list');

    console.log('sortGames', sortButton, selector, order, previousOrder, switchOrder);

    const items = Array.from(gameLists.querySelectorAll('tr'));

    items.sort((a, b) => {
        let comparison = 0;
        if (selector === '.playtime') {
            const timeA = parsePlaytime(a.querySelector(selector).textContent.trim());
            const timeB = parsePlaytime(b.querySelector(selector).textContent.trim());
            comparison = order === 'desc' ? timeB - timeA : timeA - timeB;
        } else if (selector === 'td:first-child') {
            const textA = a.querySelector(selector).textContent.trim();
            const textB = b.querySelector(selector).textContent.trim();
            comparison = order === 'desc' ? textB.localeCompare(textA) : textA.localeCompare(textB);
        } else if (selector === '.last-played') {
            const textA = a.querySelector(selector).textContent.trim();
            const textB = b.querySelector(selector).textContent.trim();
            comparison = order === 'desc' ? textB.localeCompare(textA) : textA.localeCompare(textB);
        } else {
            const textA = a.querySelector(selector).textContent.trim();
            const textB = b.querySelector(selector).textContent.trim();
            comparison = order === 'desc' ? parseFloat(textB) - parseFloat(textA) : parseFloat(textA) - parseFloat(textB);
        }

        if (comparison !== 0) return comparison;

        // 보조 정렬 기준: 초기 순서
        const aOrder = parseInt(a.getAttribute('data-order'), 10);
        const bOrder = parseInt(b.getAttribute('data-order'), 10);
        return aOrder - bOrder;
    });
    // 정렬된 항목 다시 추가
    items.forEach(item => gameLists.appendChild(item));

    // 버튼 스타일 및 애니메이션 처리
    const recentlySortedButtons = document.getElementsByClassName('recently-sorted');
    for (const recentlySortedButton of recentlySortedButtons) {
        recentlySortedButton.classList.remove('recently-sorted');
    }
    sortButton.classList.add('recently-sorted');

    if (switchOrder) {
        sortButton.classList.toggle('better-gradient');
        sortButton.classList.toggle('worse-gradient');
        sortButton.classList.toggle('desc');

        const [a, b] = sortButton.textContent.split('▶︎').map(s => s.trim());
        sortButton.textContent = `${b} ▶︎ ${a}`;
    }

    // 애니메이션 추가
    gameLists.classList.add('sorting');
    setTimeout(() => {
        gameLists.classList.remove('sorting');
    }, 500);
}

/**
 * 스코어 기준으로 게임을 소트합니다.
 * @param {string|null} forceTo - 강제 정렬 방향 ('asc' 또는 'desc')
 */
export function sortGamesByScore(forceTo = null) {
    const scoreSortButton = document.getElementById('score-sort-button');
    sortGames(scoreSortButton, '.score', forceTo);
}

/**
 * 난이도 기준으로 게임을 소트합니다.
 * @param {string|null} forceTo - 강제 정렬 방향 ('asc' 또는 'desc')
 */
export function sortGamesByWeight(forceTo = null) {
    const weightSortButton = document.getElementById('weight-sort-button');
    sortGames(weightSortButton, '.weight', forceTo);
}

/**
 * 게임 이름 기준으로 게임을 소트합니다.
 * @param {string|null} forceTo - 강제 정렬 방향 ('asc' 또는 'desc')
 */
export function sortGamesByName(forceTo = null) {
    const nameSortButton = document.getElementById('name-sort-button');
    sortGames(nameSortButton, 'td:first-child', forceTo);
}

/**
 * 플레이 시간 기준으로 게임을 소트합니다.
 * @param {string|null} forceTo - 강제 정렬 방향 ('asc' 또는 'desc')
 */
export function sortGamesByPlaytime(forceTo = null) {
    const playtimeSortButton = document.getElementById('playtime-sort-button');
    sortGames(playtimeSortButton, '.playtime', forceTo);
}

/**
 * 최근 플레이 날짜 기준으로 게임을 소트합니다.
 * @param {string|null} forceTo - 강제 정렬 방향 ('asc' 또는 'desc')
 */
export function sortGamesByDate(forceTo = null) {
    const dateSortButton = document.getElementById('date-sort-button');
    sortGames(dateSortButton, '.last-played', forceTo);
} 