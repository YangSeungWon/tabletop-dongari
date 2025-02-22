import { fetchGameData, fetchGameDetails } from './api.js';

export async function fetchWishlist() {
    const response = await fetch('data/wishlist.json?t=' + Date.now());
    if (!response.ok) {
        throw new Error(`HTTP 에러! 상태: ${response.status}`);
    }
    return response.json();
}

export function initializeWishlist() {
    loadWishlistItems();
}

async function loadWishlistItems() {
    const wishlistItems = document.getElementById('wishlist-items');
    try {
        const wishlist = await fetchWishlist();
        wishlistItems.innerHTML = '';

        for (const [koreanName, gameData] of Object.entries(wishlist)) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><a href="#" target="_blank" class="bgg-link" englishName="${gameData.englishName}">
                    ${koreanName}
                </a></td>
                <td class="score">...</td>
                <td class="weight">...</td>
                <td class="best-players">...</td>
                <td class="recommended-players">...</td>
                <td class="players">...</td>
                <td class="playtime">...</td>
                <td class="reason">${gameData.reason}</td>
            `;
            wishlistItems.appendChild(tr);

            const link = tr.querySelector('.bgg-link');
            try {
                if (gameData.englishName && typeof gameData.englishName === 'string') {
                    await fetchGameData(koreanName, gameData.englishName, link);
                } else {
                    console.warn(`영어 이름이 없습니다: ${koreanName}`);
                }
            } catch (error) {
                console.error(`게임 데이터 로드 중 에러 (${koreanName}):`, error);
            }
        }
    } catch (error) {
        console.error('위시리스트 로드 중 에러:', error);
        wishlistItems.innerHTML = '<tr><td colspan="8">위시리스트를 불러오는 중 오류가 발생했습니다.</td></tr>';
    }
} 