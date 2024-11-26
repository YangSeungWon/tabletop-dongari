document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM이 로드되었습니다. 게임 이름 매핑을 로드합니다.');

    // 영어-한국어 게임 이름 매핑 로드
    fetch('games.json')
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
                const li = document.createElement('li');
                li.innerHTML = `<a href="#" target="_blank" class="bgg-link" englishName="${englishName}" ${bggId ? `bggId="${bggId}"` : ''}>
                    ${processedKoreanName}
                </a> - 
                <span class="score">Loading...</span>
                <span class="weight">Loading...</span>
                <span class="players">Loading...</span>`;
                
                gameList.appendChild(li);
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

    return fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP 에러! 상태: ${response.status}`);
            }
            return response.text();
        })
        .then(str => (new window.DOMParser()).parseFromString(str, "text/xml"))
        .then(data => {
            const items = data.querySelectorAll('item');
            let item;
            if (items.length === 1) {
                item = items[0];
            } else {
                // Convert NodeList to Array and sort by yearpublished in descending order
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
                item = matchingItems[0]; // Get the most recent one
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

                // 상세 게임 데이터 가져오기
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

                linkElement.nextElementSibling.textContent = 'N/A';
                throw new Error('게임을 찾을 수 없습니다.');
            }
        })
        .catch(error => {
            console.error('보드게임 데이터 가져오기 에러:', error);
            linkElement.nextElementSibling.textContent = 'Error';
            return Promise.reject('Error');
        });
}

function fetchGameDetails(gameId, linkElement) {
    const detailsUrl = `https://www.boardgamegeek.com/xmlapi2/thing?id=${gameId}&stats=1`;

    return fetch(detailsUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP 에러! 상태: ${response.status}`);
            }
            return response.text();
        })
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

            linkElement.parentElement.querySelector('.score').textContent = rating;
            linkElement.parentElement.querySelector('.weight').textContent = weight;
            linkElement.parentElement.querySelector('.players').textContent = `${minPlayers} - ${maxPlayers}`;

            // set scoreand weight's text color per its value, red for low score, green for high score, gray for N/A or Error. red for high weight, green for low weight.
            const scoreElement = linkElement.parentElement.querySelector('.score');
            const weightElement = linkElement.parentElement.querySelector('.weight');
            scoreElement.style.color = getColor(rating, 'score');
            weightElement.style.color = getColor(weight, 'weight');

            return Promise.resolve([rating, weight]);
        })
        .catch(error => {
            console.error('게임 상세 데이터 에러:', error);
            linkElement.parentElement.querySelector('.score').textContent = 'Error';
            linkElement.parentElement.querySelector('.weight').textContent = 'Error';
            return Promise.reject('Error');
        });
}

function getColor(value, version) {
    if (value === 'N/A' || value === 'Error') return '#95a5a6';
    
    if (version === 'score') {
        // Linear interpolation between red (#c0392b) and green (#27ae60) based on score 5-10
        const score = parseFloat(value);
        const t = Math.max(0, Math.min(1, (score - 5) / 5)); // Normalize to 0-1 range
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

function sortGamesByScore() {
    const scoreSortButton = document.getElementById('score-sort-button');
    const order = scoreSortButton.classList.contains('desc') ? 'desc' : 'asc';
    const gameLists = document.getElementById('game-list');

    const items = Array.from(gameLists.querySelectorAll('li'));

    items.sort((a, b) => {
        const scoreA = parseFloat(a.querySelector('.score').textContent) || 0;
        const scoreB = parseFloat(b.querySelector('.score').textContent) || 0;
        return order === 'desc' ? scoreB - scoreA : scoreA - scoreB;
    });

    // 정렬된 항목 다시 추가
    items.forEach(item => gameLists.appendChild(item));

    scoreSortButton.classList.toggle('desc');
} 

function sortGamesByWeight() {
    const weightSortButton = document.getElementById('weight-sort-button');
    const order = weightSortButton.classList.contains('desc') ? 'desc' : 'asc';
    const gameLists = document.getElementById('game-list');

    const items = Array.from(gameLists.querySelectorAll('li'));

    items.sort((a, b) => {
        const weightA = parseFloat(a.querySelector('.weight').textContent) || 0;
        const weightB = parseFloat(b.querySelector('.weight').textContent) || 0;
        return order === 'desc' ? weightB - weightA : weightA - weightB;
    });

    // 정렬된 항목 다시 추가
    items.forEach(item => gameLists.appendChild(item));

    weightSortButton.classList.toggle('desc');
}