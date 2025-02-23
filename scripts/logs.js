document.addEventListener('DOMContentLoaded', () => {
    console.log('로그 페이지가 로드되었습니다. 모임 일지를 로드합니다.');

    fetchMeetings()
        .then(meetings => {
            initializeLogTable(meetings);
        })
        .catch(error => {
            console.error('meetings.json 로드 중 에러 발생:', error);
        });
});

function initializeLogTable(meetings) {
    const logTableBody = document.querySelector('#log-table tbody');

    // 모임 일지가 있는지 확인
    if (meetings.length === 0) {
        const noDataRow = document.createElement('tr');
        noDataRow.innerHTML = `<td colspan="3">등록된 모임 일지가 없습니다.</td>`;
        logTableBody.appendChild(noDataRow);
        return;
    }

    // 각 모임 일지에 대해 테이블 행 생성
    meetings.forEach(meeting => {
        const tr = document.createElement('tr');

        // 날짜 열
        const dateTd = document.createElement('td');
        dateTd.textContent = meeting.date;
        tr.appendChild(dateTd);

        // 플레이한 게임 열
        const gamesTd = document.createElement('td');
        const gamesList = document.createElement('ul');
        meeting.games.forEach(game => {
            const li = document.createElement('li');
            li.textContent = game;
            gamesList.appendChild(li);
        });
        gamesTd.appendChild(gamesList);
        tr.appendChild(gamesTd);

        logTableBody.appendChild(tr);

        // 사진 열
        const photoTd = document.createElement('td');
        const photoContainer = document.createElement('div');
        photoContainer.className = 'photo-container';

        // 날짜에서 하이픈 제거
        const date = meeting.date.replace(/-/g, '');

        // 사진 순차적으로 확인
        checkPhotosSequentially(date, photoContainer)
            .then(hasPhotos => {
                if (hasPhotos) {
                    photoTd.appendChild(photoContainer);
                } else {
                    photoTd.textContent = '사진 없음';
                }
            });

        tr.appendChild(photoTd);
    });
}

/**
 * 날짜에 해당하는 사진을 순차적으로 확인합니다.
 * @param {string} date - YYYYMMDD 형식의 날짜
 * @param {HTMLElement} container - 사진을 추가할 컨테이너
 * @returns {Promise<boolean>} 사진이 하나라도 있으면 true
 */
async function checkPhotosSequentially(date, container) {
    let photoIndex = 1;
    let hasPhotos = false;

    while (true) {
        const photoUrl = `images/meetings/${date}_${photoIndex}.jpg`;
        try {
            const exists = await checkImageExists(photoUrl);
            if (!exists) break;

            const img = document.createElement('img');
            img.src = photoUrl;
            img.alt = `${date} 모임 사진 ${photoIndex}`;
            img.className = 'meeting-photo';

            // 클릭하면 큰 이미지로 보기
            img.addEventListener('click', () => {
                const modal = document.createElement('div');
                modal.className = 'photo-modal';
                const modalImg = document.createElement('img');
                modalImg.src = photoUrl;
                modal.appendChild(modalImg);

                // 모달 클릭시 닫기
                modal.addEventListener('click', () => {
                    modal.remove();
                });

                document.body.appendChild(modal);
            });

            container.appendChild(img);
            hasPhotos = true;
            photoIndex++;
        } catch {
            break;
        }
    }

    return hasPhotos;
}

/**
 * 이미지 파일이 존재하는지 확인합니다.
 * @param {string} url - 이미지 URL
 * @returns {Promise<boolean>}
 */
async function checkImageExists(url) {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * 모임 일지를 가져옵니다.
 * @returns {Promise<Object>}
 */
export async function fetchMeetings() {
    const response = await fetch('data/meetings.json?t=' + Date.now());
    if (!response.ok) {
        throw new Error(`HTTP 에러! 상태: ${response.status}`);
    }
    return response.json();
}