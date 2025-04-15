import { fetchGameData, fetchGameDetails, openPostWindow } from './api.js';
import { parsePlaytime, checkPlayerCount } from './utils.js';
import { fetchMeetings } from './logs.js';

/**
 * 필터 레벨 슬라이더를 생성하고 초기화합니다.
 */
function createFilterLevelSlider() {
    const filterControls = document.createElement('div');
    filterControls.className = 'filter-controls';
    filterControls.style.display = 'none'; // 초기에는 숨김

    filterControls.innerHTML = `
            <label for="filter-level">필터 레벨:</label>
        <div class="slider-container">
            <input type="range" id="filter-level" min="0" max="2" value="0" step="1" class="slider" title="필터 레벨">
        </div>
    `;

    // 플레이어 수 입력 필드 다음에 슬라이더 삽입
    const playerCountInput = document.getElementById('player-count');
    playerCountInput.parentNode.insertBefore(filterControls, playerCountInput.nextSibling);

    // 슬라이더 스타일 초기화
    const filterLevelSlider = document.getElementById('filter-level');
    filterLevelSlider.style.setProperty('--slider-color', '#d3d3d3');

    return filterControls;
}

/**
 * 게임 리스트를 초기화합니다.
 * @param {Object} nameMapping
 */
export function initializeGameList(nameMapping) {
    const gameList = document.getElementById('game-list');
    let initialOrder = 0;

    // Fetch the full games data
    fetch('data/games.json?t=' + Date.now())
        .then(response => response.json())
        .then(data => {
            data.games.forEach(game => {
                let processedKoreanName = game.name;
                let bggId = null;
                if (game.name.includes('|')) {
                    [processedKoreanName, bggId] = game.name.split('|');
                }
                const tr = document.createElement('tr');
                tr.setAttribute('data-order', initialOrder++); // 초기 순서 저장
                tr.innerHTML = `
                    <td><a href="#" target="_blank" class="bgg-link" englishName="${game.englishName}" ${bggId ? `bggId="${bggId}"` : ''}>
                        ${processedKoreanName}
                    </a></td>
                    <td class="score">...</td>
                    <td class="weight">...</td>
                    <td class="best-players">...</td>
                    <td class="recommended-players">...</td>
                    <td class="players">...</td>
                    <td class="playtime">...</td>
                    <td class="last-played"></td>
                    <td class="owner">${game.owner || '공용'}</td>
                `;
                gameList.appendChild(tr);
            });

            // 필터 레벨 슬라이더 생성
            createFilterLevelSlider();

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

            const playerCountInput = document.getElementById('player-count');
            playerCountInput.value = '';

            initializeRecentPlayed();

            Promise.all(promises).then(() => {
                console.log('모든 게임 데이터를 성공적으로 로드했습니다.');

                // 초기 상태는 난이도 기준 오름차순 정렬
                sortGamesByScore('desc');
                sortGamesByWeight('asc');
            }).catch(error => {
                console.error('게임 데이터 로드 중 에러 발생:', error);
            });
        })
        .catch(error => {
            console.error('games.json 로드 중 에러 발생:', error);
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
    const filterLevelSlider = document.getElementById('filter-level');

    // Initialize slider appearance
    updateSliderAppearance(0);

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
    filterLevelSlider.addEventListener('input', handlePlayerCountInput);

    // 슬라이더 스텝 이동을 위한 레이블 클릭 이벤트
    document.querySelectorAll('.filter-label').forEach((label, index) => {
        label.addEventListener('click', () => {
            filterLevelSlider.value = index;
            handlePlayerCountInput();
        });
    });

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
    const filterControls = document.querySelector('.filter-controls');
    const filterLevelSlider = document.getElementById('filter-level');
    const filterLevel = filterLevelSlider.value; // 0: all, 1: recommended+best, 2: best only
    const playerCount = parseInt(playerCountInput.value, 10);
    const gameList = document.getElementById('game-list');
    const games = Array.from(gameList.querySelectorAll('tr'));
    let visibleCount = 0;
    const totalGames = games.length;
    const filterStatus = document.getElementById('filter-status');

    // 플레이어 수가 있을 때만 슬라이더 표시
    if (!isNaN(playerCount) && playerCount >= 1) {
        filterControls.style.display = 'block';
        // Update slider appearance
        updateSliderAppearance(filterLevel);
    } else {
        filterControls.style.display = 'none';
        filterLevelSlider.value = 0; // 슬라이더 값 초기화
    }

    // Prevent non-numeric input
    if (playerCount !== parseInt(playerCountInput.value, 10)) {
        playerCountInput.value = playerCount;
    }

    if (isNaN(playerCount) || playerCount < 1) {
        games.forEach(game => {
            game.style.display = '';
        });
        filterStatus.textContent = '';
        filterStatus.style.display = 'none';
        return;
    }

    // Filter games based on player count and filter level
    const filteredGames = games.filter(game => {
        const playersText = game.querySelector('.players').textContent;
        const [gameMin, gameMax] = playersText.split(' - ').map(num => parseInt(num, 10));
        const isInRange = playerCount >= gameMin && playerCount <= gameMax;

        if (!isInRange) return false;

        const isBest = checkPlayerCount(playerCount, game.getAttribute('data-bestwith'));
        const isRecommended = checkPlayerCount(playerCount, game.getAttribute('data-recommendedwith'));

        // Apply filter level
        if (filterLevel == 2) {
            return isBest;
        } else if (filterLevel == 1) {
            return isBest || isRecommended;
        }
        return true; // filterLevel == 0, show all playable games
    });

    // Update visibility and count
    games.forEach(game => {
        const isVisible = filteredGames.includes(game);
        game.style.display = isVisible ? '' : 'none';
        if (isVisible) visibleCount++;
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

        const aOrder = parseInt(a.getAttribute('data-order'), 10);
        const bOrder = parseInt(b.getAttribute('data-order'), 10);
        return aOrder - bOrder;
    });

    // Re-append the sorted games and apply visual styles
    filteredGames.forEach(game => {
        game.classList.remove('best-count', 'recommended-count', 'not-recommended');

        if (checkPlayerCount(playerCount, game.getAttribute('data-bestwith'))) {
            game.classList.add('best-count');
        } else if (checkPlayerCount(playerCount, game.getAttribute('data-recommendedwith'))) {
            game.classList.add('recommended-count');
        } else {
            game.classList.add('not-recommended');
        }

        gameList.appendChild(game);
    });

    // Update filter status message with filter level info
    let filterLevelText = '';
    if (filterLevel == 2) filterLevelText = ' (베스트)';
    else if (filterLevel == 1) filterLevelText = ' (추천↑)';

    filterStatus.textContent = `플레이어 수 ${playerCount}명에 맞는 게임 ${visibleCount}/${totalGames}개가 표시됩니다${filterLevelText}`;
    filterStatus.style.display = 'block';

    gameList.classList.add('sorting');
    setTimeout(() => {
        gameList.classList.remove('sorting');
    }, 500);
}

/**
 * 슬라이더의 시각적 상태를 업데이트합니다.
 * @param {string} level - 현재 필터 레벨 (0, 1, 2)
 */
function updateSliderAppearance(level) {
    const filterLevelSlider = document.getElementById('filter-level');

    // Update slider color based on level
    const colors = ['#d3d3d3', '#ffd700', '#4CAF50'];
    filterLevelSlider.style.setProperty('--slider-color', colors[level]);

    // Update tooltip based on level
    const tooltips = ['모든 게임', '추천 이상', '베스트'];
    filterLevelSlider.title = tooltips[level];
}

/**
 * 리셋 버튼 처리
 */
function handleReset() {
    const playerCountInput = document.getElementById('player-count');
    const filterControls = document.querySelector('.filter-controls');
    const filterLevelSlider = document.getElementById('filter-level');
    const gameList = document.getElementById('game-list');
    const filterStatus = document.getElementById('filter-status');

    // 필터 입력 초기화
    playerCountInput.value = '';
    filterLevelSlider.value = 0;
    filterControls.style.display = 'none'; // 슬라이더 숨김
    updateSliderAppearance(0);

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