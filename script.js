document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM이 로드되었습니다. 게임 이름 매핑을 로드합니다.');

    // 영어-한국어 게임 이름 매핑 로드 (캐싱 적용)
    cachedFetch('games.json', {}, 'games_json')
        .then(response => {
            console.log('games.json 파일을 성공적으로 로드했습니다.');
            return response.json();
        })
        .then(nameMapping => {
            // Create list items for each game
            const gameList = document.getElementById('game-list');
            for (const [koreanName, englishName] of Object.entries(nameMapping)) {
                let processedKoreanName = koreanName;
                let bggId = null;
                if (koreanName.includes('|')) {
                    [processedKoreanName, bggId] = koreanName.split('|');
                }
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><a href="#" target="_blank" class="bgg-link" englishName="${englishName}" ${bggId ? `bggId="${bggId}"` : ''}>
                        ${processedKoreanName}
                    </a></td>
                    <td class="score">Loading...</td>
                    <td class="weight">Loading...</td>
                    <td class="best-players">Loading...</td>
                    <td class="recommended-players">Loading...</td>
                    <td class="players">Loading...</td>
                `;
                gameList.appendChild(tr);
            }

            const links = document.querySelectorAll('.bgg-link');
            const promises = [];
            links.forEach(link => {
                const koreanName = link.textContent.trim();
                const englishName = link.getAttribute('englishName');
                const bggId = link.getAttribute('bggId');
                if (bggId != null) {
                    const gameUrl = `https://boardgamegeek.com/boardgame/${bggId}`;
                    link.href = gameUrl;

                    // 상세 게임 데이터 가져오기
                    promises.push(fetchGameDetails(bggId, link));
                }
                
                if (englishName) {
                    promises.push(fetchGameData(koreanName, englishName, link));
                } else {
                    console.warn(`영어 이름을 찾을 수 없습니다: ${koreanName}`);
                    link.parentElement.querySelector('.score').textContent = 'N/A';
                    link.parentElement.querySelector('.weight').textContent = 'N/A';
                }
            });

            Promise.all(promises).then(() => {
                console.log('모든 게임 데이터를 성공적으로 로드했습니다.');
                // 초기 상태는 난이도 기준 오름차순 정렬
                sortGamesByScore('desc');
                sortGamesByWeight('asc');
            });
        })
        .catch(error => {
            console.error('games.json 로드 에러:', error);
        });

    // 기존 정렬 버튼 이벤트 리스너
    const scoreSortButton = document.getElementById('score-sort-button');
    const weightSortButton = document.getElementById('weight-sort-button');
    scoreSortButton.addEventListener('click', () => {
        console.log('스코어 기준 정렬 버튼 클릭됨.');
        sortGamesByScore();
    });
    weightSortButton.addEventListener('click', () => {
        console.log('난이도 기준 정렬 버튼 클릭됨.');
        sortGamesByWeight();
    });

    // 필터 기능 업데이트
    const resetButton = document.getElementById('reset-button');
    const playerCountInput = document.getElementById('player-count');
    const gameList = document.getElementById('game-list');
    const filterStatus = document.getElementById('filter-status'); // 필터 상태 메시지 요소

    // 실시간 필터 적용: input 이벤트 리스너 추가
    playerCountInput.addEventListener('input', () => {
        const playerCount = parseInt(playerCountInput.value, 10);
        const games = Array.from(gameList.querySelectorAll('tr'));
        let visibleCount = 0;
        const totalGames = games.length;

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

            return 0; // Maintain original order if priorities are equal
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
    });

    resetButton.addEventListener('click', () => {
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
    });

    playerCountInput.value = '';
});

function openPostWindow(url, data) {
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

function fetchGameData(koreanName, englishName, linkElement) {
    const apiUrl = `https://www.boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(englishName)}&type=boardgame`;
    const cacheKey = `search_${englishName.toLowerCase()}`;

    return cachedFetch(apiUrl, {}, cacheKey)
        .then(response => {
            return response.text();
        })
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

function fetchGameDetails(gameId, linkElement) {
    const detailsUrl = `https://www.boardgamegeek.com/xmlapi2/thing?id=${gameId}&stats=1`;
    const cacheKey = `game_details_${gameId}`;

    return cachedFetch(detailsUrl, {}, cacheKey)
        .then(response => response.text())
        .then(str => (new window.DOMParser()).parseFromString(str, "text/xml"))
        .then(data => {
            const average = data.querySelector('average').getAttribute('value');
            const averageweight = data.querySelector('averageweight').getAttribute('value');
            const minPlayers = data.querySelector('minplayers').getAttribute('value');
            const maxPlayers = data.querySelector('maxplayers').getAttribute('value');
            const minAge = data.querySelector('minage').getAttribute('value');
            const description = data.querySelector('description').textContent.trim();

            const rating = average ? parseFloat(average).toFixed(2) : 'N/A';
            const weight = averageweight ? parseFloat(averageweight).toFixed(2) : 'N/A';

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

            // Store bestWith and recommendedWith as data attributes on the <li>
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

function checkPlayerCount(value, checkWith) {
    // if checkvalue is empty, return false
    if (checkWith === '') return false;
    if (checkWith === 'N/A') return false;

    // if checkvalue contains comma, there would be multiple or conditions. 
    // check them one by one.
    const checkWiths = checkWith.split(', ');
    for (const checkWith of checkWiths) {
        // if checkvalue is single number, return true if value is same as checkvalue
        if (checkWith.match(/^\d+$/)) return value === parseInt(checkWith);

        if (!checkWith.includes('–') && checkWith.endsWith('+')) { // caution: not hyphen, it is en dash (0x2013)
            return value > parseInt(checkWith.slice(0, -1));
        }

        // if checkvalue is range, return true if value is between min and max of checkvalue
        let min = checkWith.split('–')[0]; // caution: not hyphen, it is en dash (0x2013)
        let max = checkWith.split('–')[1]; // caution: not hyphen, it is en dash (0x2013)
        
        if (max.endsWith('+')) max = 999;
        if (min.endsWith('+')) min = 0;
        min = parseInt(min);
        max = parseInt(max);
        if (value >= min && value <= max) return true;
    }
    return false;
}

function getColor(value, version) {
    if (value === 'N/A' || value === 'Error') return '#95a5a6';
    
    if (version === 'score') {
        // Linear interpolation between red (#c0392b) and green (#27ae60) based on score 5-9
        const score = parseFloat(value);
        const t = Math.max(0, Math.min(1, (score - 5) / 4)); // Normalize to 0-1 range
        const r = Math.round(192 * (1-t) + 39 * t);
        const g = Math.round(57 * (1-t) + 174 * t);
        const b = Math.round(43 * (1-t) + 96 * t);
        return `rgb(${r},${g},${b})`;
    } else if (version === 'weight') {
        // Linear interpolation between green (#27ae60) and red (#c0392b) based on weight 1-5
        const weight = parseFloat(value);
        const t = Math.max(0, Math.min(1, (weight - 1) / 4)); // Normalize to 0-1 range
        const r = Math.round(39 * (1-t) + 192 * t);
        const g = Math.round(174 * (1-t) + 57 * t);
        const b = Math.round(96 * (1-t) + 43 * t);
        return `rgb(${r},${g},${b})`;
    }
}

function sortGames(sortButton, selector, forceTo = null) {
    const order = forceTo ? forceTo : sortButton.classList.contains('desc') ? 'asc' : 'desc';
    const previousOrder = sortButton.classList.contains('desc') ? 'desc' : 'asc';
    const switchOrder = previousOrder !== order;
    const gameLists = document.getElementById('game-list');

    const items = Array.from(gameLists.querySelectorAll('tr'));

    items.sort((a, b) => {
        const scoreA = parseFloat(a.querySelector(selector).textContent) || 0;
        const scoreB = parseFloat(b.querySelector(selector).textContent) || 0;
        return order === 'desc' ? scoreB - scoreA : scoreA - scoreB;
    });

    // 정렬된 항목 다시 추가
    items.forEach(item => gameLists.appendChild(item));

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

    // add animation
    gameLists.classList.add('sorting');
    setTimeout(() => {
        gameLists.classList.remove('sorting');
    }, 500);
    return;
}

function sortGamesByScore(forceTo = null) {
    const scoreSortButton = document.getElementById('score-sort-button');
    sortGames(scoreSortButton, '.score', forceTo);
}

function sortGamesByWeight(forceTo = null) {
    const weightSortButton = document.getElementById('weight-sort-button');
    sortGames(weightSortButton, '.weight', forceTo);
}

/**
 * 헬퍼 함수: 로컬 스토리지에 캐시된 데이터가 있으면 반환하고, 없으면 fetch를 수행하여 캐시에 저장한 후 반환합니다.
 * @param {string} url - 요청할 URL
 * @param {object} options - fetch 옵션
 * @param {string} cacheKey - 로컬 스토리지에 저장할 키
 * @returns {Promise<Response>} - fetch 응답
 */
function cachedFetch(url, options = {}, cacheKey = null) {
    // 캐시 키가 제공되지 않으면 URL을 키로 사용
    const key = cacheKey || url;

    // 로컬 스토리지에서 캐시된 데이터 검색
    const cached = localStorage.getItem(key);
    if (cached) {
        console.log(`캐시된 데이터를 반환합니다: ${key}`);
        // 캐시된 데이터를 반환
        return Promise.resolve(new Response(new Blob([cached])));
    }

    // 네트워크 요청 수행
    return fetch(url, options)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP 에러! 상태: ${response.status}`);
            }
            return response.clone().text().then(data => {
                try {
                    localStorage.setItem(key, data);
                } catch (e) {
                    console.warn('로컬 스토리지 저장 실패:', e);
                }
                return response;
            });
        });
}
