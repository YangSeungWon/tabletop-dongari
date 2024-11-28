/**
 * RateLimiter 클래스 정의
 */
export class RateLimiter {
    /**
     * @param {number} interval - 요청 간 간격 (밀리초)
     * @param {number} maxRetries - 최대 재시도 횟수
     * @param {number} retryDelay - 재시도 대기 시간 (밀리초)
     */
    constructor(interval, maxRetries = 3, retryDelay = 1000) {
        this.queue = [];
        this.isProcessing = false;
        this.interval = interval;
        this.maxRetries = maxRetries;
        this.retryDelay = retryDelay;
    }

    /**
     * 요청을 큐에 추가하고 처리합니다.
     * @param {Function} request - 실행할 요청 함수
     * @param {number} retries - 현재 재시도 횟수
     * @returns {Promise<Response>}
     */
    enqueue(request, retries = 0) {
        return new Promise((resolve, reject) => {
            this.queue.push({ request, resolve, reject, retries });
            this.processQueue();
        });
    }

    /**
     * 큐에서 요청을 처리합니다.
     */
    async processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;

        this.isProcessing = true;
        const { request, resolve, reject, retries } = this.queue.shift();

        try {
            const response = await request();
            if (!response.ok) {
                if (retries < this.maxRetries) {
                    console.warn(`요청 실패: ${response.status}. 재시도 ${retries + 1}/${this.maxRetries}...`);
                    setTimeout(() => {
                        this.enqueue(request, retries + 1).then(resolve).catch(reject);
                    }, this.retryDelay);
                } else {
                    console.error(`요청 실패: ${response.status}. 최대 재시도 횟수 초과.`);
                    reject(new Error(`HTTP 에러! 상태: ${response.status}`));
                }
            } else {
                // 성공 시 재시도 지연 시간 조정 가능
                resolve(response);
            }
        } catch (error) {
            // 네트워크 오류 등 처리
            if (retries < this.maxRetries) {
                console.warn(`요청 에러: ${error.message}. 재시도 ${retries + 1}/${this.maxRetries}...`);
                setTimeout(() => {
                    this.enqueue(request, retries + 1).then(resolve).catch(reject);
                }, this.retryDelay);
            } else {
                console.error(`요청 에러: ${error.message}. 최대 재시도 횟수 초과.`);
                reject(error);
            }
        }

        this.isProcessing = false;

        // 지정된 간격 후에 다음 요청 처리
        setTimeout(() => {
            this.processQueue();
        }, this.interval);
    }
}

// 전역 RateLimiter 인스턴스 (300ms 간격, 최대 3회 재시도, 2000ms 재시도 대기)
const rateLimiter = new RateLimiter(300, 3, 2000);

/**
 * 레이트 리미팅된 fetch 함수
 * @param {string} url - 요청할 URL
 * @param {object} options - fetch 옵션
 * @returns {Promise<Response>}
 */
export async function rateLimitedFetch(url, options = {}) {
    return rateLimiter.enqueue(() => fetch(url, options));
} 