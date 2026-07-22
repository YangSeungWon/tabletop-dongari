import { applyStats } from './api.js';

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

            // BGG를 실시간 호출하지 않고, 미리 캐시된 stats를 렌더한다.
            applyStats(tr.querySelector('.bgg-link'), gameData.stats);
        }
    } catch (error) {
        console.error('위시리스트 로드 중 에러:', error);
        wishlistItems.innerHTML = '<tr><td colspan="8">위시리스트를 불러오는 중 오류가 발생했습니다.</td></tr>';
    }
} 