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
        noDataRow.innerHTML = `<td colspan="2">등록된 모임 일지가 없습니다.</td>`;
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
    });

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