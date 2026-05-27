const API_URL = "http://localhost:8000/api";
let currentSelectedId = null;

// 1. Segment Data for Guide Tabs
const segmentDetails = {
    vulnerable: {
        title: "인과적 위기 취약군 (Vulnerables)",
        badge: "최우선 타겟 (사각지대 집중 개입)",
        badgeColor: "bg-red-50 text-red-700 border-red-200 shadow-sm shadow-red-50/50",
        count: "1,831명 (약 20.0%)",
        desc: "현재 진로 고민이 없는 미개입 상태(T=0)이지만, 향후 진로 고민이 시작될 경우 그것이 학업 및 성적 스트레스로 도미노처럼 확산되는 <strong>인과적 위기 전이 데미지(Uplift Score)가 전체 미개입군 중 하위 20%로 가장 깊은 핵심 취약층</strong>입니다. 단순 예측으로는 찾아낼 수 없는 <strong>보이지 않는 교육 복지 최종 사각지대</strong>이므로 예산과 행정 자원을 최우선 집중 투입해야 합니다.",
        strategy: "진로·정서 프로그램 우선 매칭, 1:1 맞춤형 멘토링 매칭, 교육복지 예산 및 장학 자원 최우선 선제 배정",
        metrics: {
            uplift: "데미지 극심 (하위 20%)",
            intervention: "미개입 상태 (T=0)",
            stressRelief: "위기 발생 시 급격한 붕괴 위험"
        }
    },
    surething: {
        title: "자율 안심군 (Sure Things)",
        badge: "자율 안심 (주기적 정기 관찰)",
        badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm shadow-emerald-50/50",
        count: "6,521명 (71.2%)",
        desc: "진로 고민에 노출되지 않은 상태(T=0)이면서 스스로 학업 및 성적 스트레스를 통제(Y=1)하고 있는 <strong>회복탄력성 우수 학생 집단</strong>입니다. 이들은 인과 점수가 0에 가깝거나 높아 <strong>추가적인 특수 개입 없이도 스스로 위기를 극복하는 뛰어난 완충 능력</strong>을 갖추고 있으므로, 자원 배정을 최소화하여 행정적 효율성을 유지하는 지표가 됩니다.",
        strategy: "연 1회 표준 정서 설문 모니터링, 학교 자율 진로 탐색 및 보편적 복지 활동 기회 보장",
        metrics: {
            uplift: "0에 수렴 (양호)",
            intervention: "미개입 상태 (T=0)",
            stressRelief: "자체 극복력 매우 우수"
        }
    },
    lostcause: {
        title: "장기 만성 위기군 (Lost Causes)",
        badge: "심층 개입 (다각도 정밀 처방)",
        badgeColor: "bg-amber-50 text-amber-700 border-amber-200 shadow-sm shadow-amber-50/50",
        count: "495명 (5.4%)",
        desc: "이미 학교의 진로 상담이나 개입(T=1)을 받았음에도 불구하고, 고3 시점까지 스트레스 완화에 실패하고 극심한 학업 스트레스(Y=0)를 장기 만성적으로 겪고 있는 고위험 집단입니다. <strong>단순 상담 및 격려를 넘어 다각적인 복합 정서 케어와 외부 연계 상담이 시급</strong>한 학생들입니다.",
        strategy: "다학제적 전문가 상담 연계, 위클래스(Wee Class) 밀착 정밀 케어, 가정 방문 및 학부모 밀착 상담 연대",
        metrics: {
            uplift: "효과 미비 (추가 분석 필요)",
            intervention: "기개입 상태 (T=1)",
            stressRelief: "완화 실패 상태 (Y=0)"
        }
    },
    others: {
        title: "기타관리군 (Others)",
        badge: "일반 관리 (상시 모니터링)",
        badgeColor: "bg-slate-50 text-slate-700 border-slate-200",
        count: "310명 (3.4%)",
        desc: "개입 유무 및 인과 점수가 임계값(T=0 하위 20%) 범위 밖에 위치하여, 특이적인 인과 데미지 경로를 보이지 않는 일반 학생군입니다. 정책적 예산 집중 투입보다는 <strong>학교의 일반 행정 가이드라인 내에서 주기적인 면담과 보편적 프로그램 기회</strong>를 제공하기에 적합합니다.",
        strategy: "담임 교사 주도의 학기별 1회 일상 정기 면담, 보편적 학급 단합 행사 참여 권장",
        metrics: {
            uplift: "일반 수준",
            intervention: "혼재 (T=0 or T=1)",
            stressRelief: "일반 조절 수준"
        }
    }
};

// 2. 초기 구동 로드
async function init() {
    // Lucide 아이콘 초기화
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // 글로벌 통계 및 학생 명단 로드
    await fetchGlobalStats();
    await fetchStudentList();

    // 세그먼트 가이드 초기화
    switchSegmentTab('vulnerable');
}

// 3. 글로벌 통계 연동
async function fetchGlobalStats() {
    try {
        const res = await fetch(`${API_URL}/dashboard/stats`);
        const data = await res.json();
        document.getElementById('statTotal').innerText = data.total_students.toLocaleString();
        document.getElementById('statVulnerables').innerText = data.vulnerables_count.toLocaleString();
        document.getElementById('statLostCauses').innerText = data.lost_causes_count.toLocaleString();
        document.getElementById('statSureThings').innerText = data.sure_things_count.toLocaleString();
        
        // cutoff 수치 대시보드에 표출
        const cutoffEl = document.getElementById('vulnerablesCutoffValue');
        if (cutoffEl) {
            cutoffEl.innerText = data.vulnerables_cutoff.toFixed(4);
        }
    } catch (error) {
        console.error("글로벌 통계를 가져오는 데 실패했습니다:", error);
    }
}

// 4. 학생 사이드바 목록 연동
async function fetchStudentList() {
    try {
        const res = await fetch(`${API_URL}/students`);
        const data = await res.json();
        const select = document.getElementById('studentSelect');
        const listContainer = document.getElementById('studentList');

        // 기존 목록 비우기 (기본값 제외)
        select.innerHTML = '<option value="">학생 고유 ID 선택...</option>';
        listContainer.innerHTML = '';

        data.students.forEach(std => {
            // 셀렉트박스 아이템 추가
            const opt = document.createElement('option');
            opt.value = std.ID;
            opt.innerText = `학생 ID: ${std.ID}`;
            select.appendChild(opt);

            // 명단 리스트 컴포넌트 추가
            let segmentName = "기타관리군";
            let badgeColor = "bg-slate-50 text-slate-600 border border-slate-200";
            let dotClass = "bg-slate-400";

            if (std.segment.includes('인과적 위기 취약군')) {
                segmentName = "위기 취약군";
                badgeColor = "bg-red-50 text-red-700 border border-red-100";
                dotClass = "bg-red-500 animate-pulse";
            } else if (std.segment.includes('장기 만성 위기군')) {
                segmentName = "만성 위기군";
                badgeColor = "bg-amber-50 text-amber-700 border border-amber-100";
                dotClass = "bg-amber-500";
            } else if (std.segment.includes('자율 안심군')) {
                segmentName = "자율 안심군";
                badgeColor = "bg-emerald-50 text-emerald-700 border border-emerald-100";
                dotClass = "bg-emerald-500";
            } else {
                segmentName = "기타관리군";
                badgeColor = "bg-slate-50 text-slate-600 border border-slate-100";
                dotClass = "bg-slate-400";
            }

            const item = document.createElement('div');
            item.className = `flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer transition-all duration-200 border border-transparent hover:border-slate-200 group`;
            item.onclick = () => { select.value = std.ID; fetchStudentDetail(std.ID); };
            item.innerHTML = `
                <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full ${dotClass}"></span>
                    <span class="font-medium text-slate-700 group-hover:text-indigo-600 transition-colors">ID ${std.ID}</span>
                </div>
                <span class="px-2 py-0.5 rounded-lg text-[10px] font-semibold ${badgeColor}">${segmentName}</span>
            `;
            listContainer.appendChild(item);
        });
    } catch (error) {
        console.error("학생 목록을 가져오는 데 실패했습니다:", error);
    }
}

// 5. 학생 단건 상세 정보 조회
async function fetchStudentDetail(id) {
    if (!id) return;
    currentSelectedId = id;

    // 사이드바 선택 상태 강조
    const listItems = document.querySelectorAll('#studentList > div');
    listItems.forEach(item => {
        const text = item.querySelector('.font-medium').innerText;
        if (text.includes(`ID ${id}`)) {
            item.classList.add('bg-indigo-50/50', 'border-indigo-100');
        } else {
            item.classList.remove('bg-indigo-50/50', 'border-indigo-100');
        }
    });

    try {
        const res = await fetch(`${API_URL}/student/${id}`);
        const data = await res.json();

        document.getElementById('detailId').innerText = data.id;
        document.getElementById('detailGender').innerText = data.gender;
        document.getElementById('detailHappiness').innerText = `${data.happiness} / 10 점`;
        document.getElementById('detailSegment').innerText = data.segment;
        document.getElementById('detailUplift').innerText = data.uplift_score.toFixed(4);
        
        // 정밀 위기 분석 레벨 표출 및 뱃지 스타일링
        const levelEl = document.getElementById('detailVulnerableLevel');
        if (levelEl) {
            levelEl.innerText = data.vulnerable_level;
            if (data.vulnerable_level.includes('Level 3')) {
                levelEl.className = "text-xs font-bold text-red-600 bg-red-50 border border-red-150 px-2 py-0.5 rounded-lg inline-block whitespace-nowrap badge-status";
            } else if (data.vulnerable_level.includes('Level 2')) {
                levelEl.className = "text-xs font-bold text-orange-600 bg-orange-50 border border-orange-150 px-2 py-0.5 rounded-lg inline-block whitespace-nowrap";
            } else if (data.vulnerable_level.includes('Level 1')) {
                levelEl.className = "text-xs font-bold text-amber-600 bg-amber-50 border border-amber-150 px-2 py-0.5 rounded-lg inline-block whitespace-nowrap";
            } else if (data.vulnerable_level.includes('정서적 자율')) {
                levelEl.className = "text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded-lg inline-block whitespace-nowrap";
            } else {
                levelEl.className = "text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-150 px-2 py-0.5 rounded-lg inline-block whitespace-nowrap";
            }
        }

        // 세그먼트에 따른 텍스트 강조 컬러링
        const segEl = document.getElementById('detailSegment');
        if (data.segment.includes('인과적 위기 취약군')) {
            segEl.className = "text-sm font-bold text-red-600 px-2 py-0.5 rounded-lg bg-red-50 border border-red-100 inline-block whitespace-nowrap";
        } else if (data.segment.includes('장기 만성 위기군')) {
            segEl.className = "text-sm font-bold text-amber-600 px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-100 inline-block whitespace-nowrap";
        } else if (data.segment.includes('자율 안심군')) {
            segEl.className = "text-sm font-bold text-emerald-600 px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-100 inline-block whitespace-nowrap";
        } else {
            segEl.className = "text-sm font-bold text-slate-600 px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-100 inline-block whitespace-nowrap";
        }

        // 버튼 활성화
        const btn = document.getElementById('llmBtn');
        btn.removeAttribute('disabled');
        btn.className = "w-full mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer llm-loading-glow";
    } catch (error) {
        console.error("학생 상세 정보를 가져오는 데 실패했습니다:", error);
    }
}

// 6. Claude 솔루션 레포트 생성 호출
async function requestLLMGuide() {
    const apiKey = document.getElementById('apiKey').value;
    const display = document.getElementById('llmDisplay');
    const regenBtn = document.getElementById('regenerateBtn');

    if (!apiKey) {
        alert("상단 바에 Claude API Key를 입력하셔야 실시간 에이전트 연동이 활성화됩니다.");
        document.getElementById('apiKey').focus();
        return;
    }

    // 재생성 버튼 로딩 상태 표시 및 노출
    if (regenBtn) {
        regenBtn.classList.remove('hidden');
        regenBtn.classList.add('flex', 'opacity-50', 'pointer-events-none');
        regenBtn.innerHTML = `<i data-lucide="refresh-cw" class="w-3.5 h-3.5 animate-spin"></i> 생성 중...`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    display.innerHTML = `
        <div class="flex flex-col items-center justify-center min-h-[250px] gap-3 text-indigo-600">
            <span class="relative flex h-4 w-4">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-4 w-4 bg-indigo-600"></span>
            </span>
            <div class="font-semibold text-slate-800">Claude 4.5 Sonnet 에이전트 분석 중</div>
            <div class="text-xs text-slate-500">학생의 인과 데이터 패턴 및 기저 변수(X)를 분석하여 맞춤형 상담 전략을 빌딩하고 있습니다...</div>
        </div>
    `;

    try {
        const res = await fetch(`${API_URL}/student/llm-guide`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_id: parseInt(currentSelectedId), api_key: apiKey })
        });
        const data = await res.json();
        if (res.ok) {
            // HTML 포맷 정리 및 렌더링
            display.innerHTML = formatLLMResponse(data.guide);
        } else {
            display.innerHTML = `
                <div class="p-4 rounded-xl bg-red-50 border border-red-100 text-red-800 text-sm">
                    <h4 class="font-bold flex items-center gap-1.5"><i data-lucide="x-circle" class="w-4 h-4"></i> 분석 실패</h4>
                    <p class="mt-1">${data.detail}</p>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    } catch (e) {
        display.innerHTML = `
            <div class="p-4 rounded-xl bg-red-50 border border-red-100 text-red-800 text-sm">
                <h4 class="font-bold flex items-center gap-1.5"><i data-lucide="alert-triangle" class="w-4 h-4"></i> 서버 연결 실패</h4>
                <p class="mt-1">FastAPI 백엔드 서버(http://localhost:8000)가 정상 작동 중인지 확인해 주세요.</p>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } finally {
        // 재생성 버튼 활성화 상태로 복구
        if (regenBtn) {
            regenBtn.classList.remove('opacity-50', 'pointer-events-none');
            regenBtn.innerHTML = `<i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> 솔루션 재발행`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }
}

// 7. Claude Markdown 응답을 프리미엄 카드 컴포넌트로 포맷팅
function formatLLMResponse(text) {
    let formatted = text;
    
    // 이중 개행 정돈
    formatted = formatted.trim();

    // 3가지 큰 대주제에 따라 프리미엄 컬러 카드 디자인 적용
    formatted = formatted
        .replace(/## 🎯 1\. (.*)/g, '<div class="bg-red-50/40 border border-red-100 p-5 rounded-2xl shadow-sm mb-6 flex flex-col gap-3"><h4 class="text-sm font-bold text-red-800 flex items-center gap-2"><i data-lucide="alert-circle" class="w-4.5 h-4.5"></i> 🎯 1. $1</h4><div class="text-slate-700 text-sm leading-relaxed font-medium space-y-2">')
        .replace(/## 💬 2\. (.*)/g, '</div></div><div class="bg-indigo-50/40 border border-indigo-100 p-5 rounded-2xl shadow-sm mb-6 flex flex-col gap-3"><h4 class="text-sm font-bold text-indigo-800 flex items-center gap-2"><i data-lucide="message-square" class="w-4.5 h-4.5"></i> 💬 2. $1</h4><div class="text-slate-700 text-sm leading-relaxed font-medium space-y-2">')
        .replace(/## 📱 3\. (.*)/g, '</div></div><div class="bg-emerald-50/40 border border-emerald-100 p-5 rounded-2xl shadow-sm mb-6 flex flex-col gap-3"><h4 class="text-sm font-bold text-emerald-800 flex items-center gap-2"><i data-lucide="smartphone" class="w-4.5 h-4.5"></i> 📱 3. $1</h4><div class="text-slate-750 bg-white/70 backdrop-blur border border-emerald-100 p-4 rounded-xl font-mono text-sm leading-relaxed shadow-inner shadow-emerald-50/30">');
    
    // 마지막 열린 div 닫기
    formatted += '</div></div>';

    // 부가적인 마크다운 요소 파싱
    formatted = formatted
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-900 font-bold">$1</strong>')
        .replace(/- (.*)/g, '<li class="ml-4 list-disc mt-1.5 text-slate-600">$1</li>')
        .replace(/\n/g, '<br>');

    // 렌더링 직후 Lucide 아이콘 초기화 트리거
    setTimeout(() => {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }, 80);

    return formatted;
}

// 8. 4가지 군집 탭 전환 기능
function switchSegmentTab(segmentKey) {
    const data = segmentDetails[segmentKey];
    if (!data) return;

    // 모든 탭 버튼 비활성화 스타일
    const tabs = ['vulnerable', 'surething', 'lostcause', 'others'];
    tabs.forEach(tab => {
        const btn = document.getElementById(`tab-${tab}`);
        if (btn) {
            btn.className = "px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all cursor-pointer";
        }
    });

    // 선택된 탭 활성화 스타일
    const activeBtn = document.getElementById(`tab-${segmentKey}`);
    if (activeBtn) {
        if (segmentKey === 'vulnerable') {
            activeBtn.className = "px-4 py-2 text-xs font-semibold rounded-xl border border-red-200 bg-red-50 text-red-700 shadow-sm transition-all cursor-pointer";
        } else if (segmentKey === 'surething') {
            activeBtn.className = "px-4 py-2 text-xs font-semibold rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm transition-all cursor-pointer";
        } else if (segmentKey === 'lostcause') {
            activeBtn.className = "px-4 py-2 text-xs font-semibold rounded-xl border border-amber-200 bg-amber-50 text-amber-700 shadow-sm transition-all cursor-pointer";
        } else {
            activeBtn.className = "px-4 py-2 text-xs font-semibold rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm transition-all cursor-pointer";
        }
    }

    // 데이터 렌더링
    document.getElementById('guideTitle').innerText = data.title;
    document.getElementById('guideBadge').innerText = data.badge;
    document.getElementById('guideBadge').className = `px-3 py-1 rounded-full text-xs font-bold border ${data.badgeColor}`;
    document.getElementById('guideCount').innerText = data.count;
    document.getElementById('guideDesc').innerHTML = data.desc;
    document.getElementById('guideStrategy').innerText = data.strategy;

    document.getElementById('metricUplift').innerText = data.metrics.uplift;
    document.getElementById('metricIntervention').innerText = data.metrics.intervention;
    document.getElementById('metricRelief').innerText = data.metrics.stressRelief;
}

// 9. 메인 네비게이션 탭 전환 기능
function switchMainTab(tabKey) {
    const monitorTab = document.getElementById('main-tab-monitor');
    const guideTab = document.getElementById('main-tab-guide');
    const monitorContent = document.getElementById('content-monitor');
    const guideContent = document.getElementById('content-guide');

    if (!monitorTab || !guideTab || !monitorContent || !guideContent) return;

    if (tabKey === 'monitor') {
        // 활성 탭 디자인 적용
        monitorTab.className = "border-b-2 border-indigo-600 px-6 py-3 text-sm font-semibold text-indigo-600 transition-all cursor-pointer flex items-center gap-2";
        guideTab.className = "border-b-2 border-transparent px-6 py-3 text-sm font-semibold text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-all cursor-pointer flex items-center gap-2";

        // 콘텐츠 보이기/숨기기
        monitorContent.classList.remove('hidden');
        guideContent.classList.add('hidden');
    } else if (tabKey === 'guide') {
        // 활성 탭 디자인 적용
        monitorTab.className = "border-b-2 border-transparent px-6 py-3 text-sm font-semibold text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-all cursor-pointer flex items-center gap-2";
        guideTab.className = "border-b-2 border-indigo-600 px-6 py-3 text-sm font-semibold text-indigo-600 transition-all cursor-pointer flex items-center gap-2";

        // 콘텐츠 보이기/숨기기
        monitorContent.classList.add('hidden');
        guideContent.classList.remove('hidden');

        // 아이콘 리프레시
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
}

// 윈도우 로드 시 실행 등록
window.onload = init;
window.switchSegmentTab = switchSegmentTab; // 전역 스코프 등록 (인라인 onclick 지원용)
window.switchMainTab = switchMainTab;
window.fetchStudentDetail = fetchStudentDetail;
window.requestLLMGuide = requestLLMGuide;

