import { fetchGames } from './api.js';
import { initializeGameList, initializeEventListeners, sortGamesByScore, sortGamesByWeight } from './ui.js';


document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM이 로드되었습니다. 게임 이름 매핑을 로드합니다.');

    // 게임 이름 매핑 로드
    fetchGames()
        .then(nameMapping => {
            initializeGameList(nameMapping);
            initializeEventListeners();
            sortGamesByScore('desc');
            sortGamesByWeight('asc');
        })
        .catch(error => {
            console.error('games.json 로드 에러:', error);
        });
});
