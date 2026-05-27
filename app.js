const API_URL = "http://localhost:8000/api";
let currentSelectedId = null;

// 1. Segment Data for Guide Tabs
const segmentDetails = {
    persuadable: {
        title: "설득가능군 (Persuadables)",
        badge: "1순위 타겟 (집중 처방)",
        badgeColor: "bg-red-100 text-red-800 border-red-200",
        count: "1,674명 (18.3%)",
        desc: "현재 학교의 개입을 받지 않은 상태(T=0)이지만, 상담이나 교육 복지 자원을 개입시킬 경우 고3 시기 성적 스트레스를 완화시킬 수 있는 인과적 개선 효과(Uplift Score)가 가장 극대화되는 학생 집단입니다. <strong>한정된 재정 및 행정력을 투입할 때 가장 가성비가 높은 핵심 계층</strong>입니다.",
        strategy: "진로·상담 프로그램 우선 배정, 맞춤형 멘토링 매칭, 복지 예산 최우선 집중 투입",
        metrics: {
            uplift: "매우 높음 (Top 20% 이내)",
            intervention: "미개입 상태 (T=0)",
            stressRelief: "개입 시 극대화"
        }
    },
    surething: {
        title: "안심군 (Sure Things)",
        badge: "3순위 타겟 (자율 안정)",
        badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
        count: "6,521명 (71.2%)",
        desc: "특별한 외부 개입(T=0)이 없이도 스스로 학업 스트레스를 조절하고 위기를 헤쳐 나가는 자율 조절 능력을 갖춘 학생 집단입니다. <strong>추가적인 복지 자원 투입을 최소화하여 예산 누수를 방지</strong>하는 지표가 됩니다.",
        strategy: "주기적인 기본 정서 설문 관찰, 자율적인 진로 탐색 활동 기회 보장",
        metrics: {
            uplift: "낮음 / 불필요",
            intervention: "미개입 상태 (T=0)",
            stressRelief: "스스로 해결 가능"
        }
    },
    lostcause: {
        title: "철벽군 (Lost Causes)",
        badge: "2순위 타겟 (심층 진단)",
        badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
        count: "495명 (5.4%)",
        desc: "이미 학교의 진로 상담이나 개입(T=1)을 받았음에도 불구하고, 여전히 고3 당시 학업 스트레스 수치가 완화되지 않고 매우 높게 나타나는 만성적 위기 집단입니다. <strong>단순한 학업 상담 외에 다각도의 정서적 지원이 필요한 고위험군</strong>입니다.",
        strategy: "다학제적 전문가 상담 연계, 위클래스(Wee Class) 심층 케어, 가정 방문 및 보호자 연대",
        metrics: {
            uplift: "효과 미비 (추가 분석 필요)",
            intervention: "개입 받음 (T=1)",
            stressRelief: "완화 실패 (Y=0)"
        }
    },
    others: {
        title: "기타관리군 (Others)",
        badge: "4순위 타겟 (일반 모니터링)",
        badgeColor: "bg-slate-100 text-slate-800 border-slate-200",
        count: "467명 (5.1%)",
        desc: "개입 여부와 상관없이 무던하게 반응하거나, 분류 임계치 아래에 있어 뚜렷한 인과 관계를 추정하기 어려운 집단입니다. 정책적 집중 투입보다는 <strong>일반 행정 가이드라인 내에서 모니터링</strong>하기에 적합합니다.",
        strategy: "담임 교사 주도의 연 2회 정기 면담, 학교 행사의 보편적 참여 권장",
        metrics: {
            uplift: "미미함",
            intervention: "혼재 (T=0 or T=1)",
            stressRelief: "일반 수준"
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
    switchSegmentTab('persuadable');
}

// 3. 글로벌 통계 연동
async function fetchGlobalStats() {
    try {
        const res = await fetch(`${API_URL}/dashboard/stats`);
        const data = await res.json();
        document.getElementById('statTotal').innerText = data.total_students.toLocaleString();
        document.getElementById('statPersuadables').innerText = data.persuadables_count.toLocaleString();
        document.getElementById('statLostCauses').innerText = data.lost_causes_count.toLocaleString();
        document.getElementById('statSureThings').innerText = data.sure_things_count.toLocaleString();
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
        btn.className = "w-full mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer";
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

// 7. Claude Markdown 응답을 좀 더 이쁘게 파싱 및 포맷팅
function formatLLMResponse(text) {
    // 마크다운 문법 간단히 HTML로 변환
    let formatted = text
        .replace(/### (.*)/g, '<h4 class="text-sm font-bold text-slate-900 mt-4 mb-2">$1</h4>')
        .replace(/## (.*)/g, '<h3 class="text-base font-bold text-slate-900 mt-6 mb-3 border-b border-slate-100 pb-1">$1</h3>')
        .replace(/1\.\s(.*)/g, '<div class="mt-2 font-semibold text-slate-800">1. $1</div>')
        .replace(/2\.\s(.*)/g, '<div class="mt-2 font-semibold text-slate-800">2. $1</div>')
        .replace(/3\.\s(.*)/g, '<div class="mt-2 font-semibold text-slate-800">3. $1</div>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
    return formatted;
}

// 8. 4가지 군집 탭 전환 기능
function switchSegmentTab(segmentKey) {
    const data = segmentDetails[segmentKey];
    if (!data) return;

    // 모든 탭 버튼 비활성화 스타일
    const tabs = ['persuadable', 'surething', 'lostcause', 'others'];
    tabs.forEach(tab => {
        const btn = document.getElementById(`tab-${tab}`);
        if (btn) {
            btn.className = "px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all cursor-pointer";
        }
    });

    // 선택된 탭 활성화 스타일
    const activeBtn = document.getElementById(`tab-${segmentKey}`);
    if (activeBtn) {
        if (segmentKey === 'persuadable') {
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
