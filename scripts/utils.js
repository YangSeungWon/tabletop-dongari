/**
 * 플레이타임 텍스트를 파싱하여 평균 시간을 반환합니다.
 * @param {string} playtimeText
 * @returns {number}
 */
export function parsePlaytime(playtimeText) {
    const [min, max] = playtimeText.split(' - ').map(time => parseInt(time, 10));
    return max ? (min + max) / 2 : min;
}

/**
 * 플레이어 수를 확인합니다.
 * @param {number} value
 * @param {string} checkWith
 * @returns {boolean}
 */
export function checkPlayerCount(value, checkWith) {
    // if checkvalue is empty, return false
    if (checkWith === '') return false;
    if (checkWith === 'N/A') return false;

    // if checkvalue contains comma, there would be multiple or conditions. 
    // check them one by one.
    const checkWiths = checkWith.split(', ');
    for (const cw of checkWiths) {
        // if checkvalue is single number, return true if value is same as checkvalue
        if (cw.match(/^\d+$/)) {
            if (value === parseInt(cw)) {
                return true;
            } else {
                continue;
            }
        }

        if (!cw.includes('–') && cw.endsWith('+')) { // caution: not hyphen, it is en dash (0x2013)
            if (value > parseInt(cw.slice(0, -1))) {
                return true;
            } else {
                continue;
            }
        }

        // if checkvalue is range, return true if value is between min and max of checkvalue
        let [min, max] = cw.split('–'); // caution: not hyphen, it is en dash (0x2013)
        
        if (max.endsWith('+')) max = 999;
        if (min.endsWith('+')) min = 0;
        min = parseInt(min);
        max = parseInt(max);
        if (value >= min && value <= max) {
            return true;
        } else {
            continue;
        }
    }
    return false;
}


export function getColor(value, version) {
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
