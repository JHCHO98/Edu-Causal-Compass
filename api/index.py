"""
Edu-Causal Compass API — Vercel Serverless Function 진본 코드
- 로컬 개발: `python server.py` (루트의 shim이 이 모듈을 import)
- 배포: Vercel이 `/api/*` 경로의 모든 요청을 이 함수로 라우팅 (vercel.json rewrites 참조)
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import pandas as pd
import os
from anthropic import Anthropic

app = FastAPI(title="Edu-Causal Compass API", version="1.0")

# 🔒 CORS — 같은 도메인 호스팅이므로 큰 의미는 없으나 로컬 개발 호환을 위해 유지
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 서버리스 함수는 cwd가 일정하지 않으므로 모듈 디렉토리 기준 절대경로 사용
BASE_DIR = os.path.dirname(__file__)
PROJECT_ROOT = os.path.dirname(BASE_DIR)
DATA_PATH = os.path.join(BASE_DIR, "step2_output.csv")

def reclassify_segments(df: pd.DataFrame) -> pd.DataFrame:
    """★ 핵심 로직: 인과적 위기 전이(Risk Spreading) 모델 기반 4대 군집 동적 재분류
    - 모든 uplift_score는 음수 영역에 존재 (진로 위기 → 성적 스트레스 전이 구조)
    - 하위 20%: 위기 전이 데미지가 극심한 '사각지대' 핵심 타겟
    - 0에 가까울수록: 회복탄력성 높은 자율 안심 학생
    """
    df = df.copy()
    t0_scores = df.loc[df['T'] == 0, 'uplift_score']
    cutoff = t0_scores.quantile(0.20)

    def assign_segment(row):
        if row['T'] == 0 and row['uplift_score'] <= cutoff:
            return '인과적 위기 취약군 (Vulnerables)'
        elif row['T'] == 0 and row['Y'] == 1:
            return '자율 안심군 (Sure Things)'
        elif row['T'] == 1 and row['Y'] == 0:
            return '장기 만성 위기군 (Lost Causes)'
        else:
            return '기타관리군'

    df['segment'] = df.apply(assign_segment, axis=1)
    return df

def load_data():
    if not os.path.exists(DATA_PATH):
        raise HTTPException(status_code=500, detail=f"AI 결과 데이터 파일이 존재하지 않습니다: {DATA_PATH}")
    df = pd.read_csv(DATA_PATH)
    return reclassify_segments(df)

# 1. 대시보드 상단 요약 통계 API
@app.get("/api/dashboard/stats")
def get_stats():
    df = load_data()
    total = len(df)
    vulnerables = len(df[df['segment'] == '인과적 위기 취약군 (Vulnerables)'])
    lost_causes = len(df[df['segment'] == '장기 만성 위기군 (Lost Causes)'])
    sure_things = len(df[df['segment'] == '자율 안심군 (Sure Things)'])
    t0_cutoff = float(df.loc[df['T'] == 0, 'uplift_score'].quantile(0.20))
    return {
        "total_students": total,
        "vulnerables_count": vulnerables,
        "lost_causes_count": lost_causes,
        "sure_things_count": sure_things,
        "vulnerables_cutoff": round(t0_cutoff, 4),
    }

# 2. 학생 목록 조회 API — 위기 취약군 최우선 정렬 후 페이지네이션
@app.get("/api/students")
def get_students(page: int = 1, page_size: int = 30):
    df = load_data()
    vulnerables = df[df['segment'] == '인과적 위기 취약군 (Vulnerables)'].sort_values('uplift_score')
    others = df[df['segment'] != '인과적 위기 취약군 (Vulnerables)'].sort_values('uplift_score', ascending=False)
    full = pd.concat([vulnerables, others])[['ID', 'segment']]

    total = len(full)
    page_size = max(1, min(page_size, 100))
    total_pages = max(1, (total + page_size - 1) // page_size)
    page = max(1, min(page, total_pages))

    start = (page - 1) * page_size
    end = start + page_size
    page_data = full.iloc[start:end]

    return {
        "students": page_data.to_dict(orient="records"),
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages,
    }

# 3. 개별 학생 상세 정보 조회 API
@app.get("/api/student/{student_id}")
def get_student_detail(student_id: int):
    df = load_data()
    student_row = df[df['ID'] == student_id]
    if student_row.empty:
        raise HTTPException(status_code=404, detail="해당 학생을 찾을 수 없습니다.")

    data = student_row.iloc[0].to_dict()
    uplift = float(data["uplift_score"])
    t_val = int(data["T"])

    t0_scores = df.loc[df['T'] == 0, 'uplift_score']
    cutoff_5 = t0_scores.quantile(0.05)
    cutoff_10 = t0_scores.quantile(0.10)
    cutoff_20 = t0_scores.quantile(0.20)

    if t_val == 0:
        if uplift <= cutoff_5:
            vulnerable_level = "최고 위험 (Level 3 - 즉각 개입)"
        elif uplift <= cutoff_10:
            vulnerable_level = "고위험 (Level 2 - 집중 관리)"
        elif uplift <= cutoff_20:
            vulnerable_level = "경계 (Level 1 - 적극 모니터링)"
        else:
            vulnerable_level = "정서적 자율 통제 상태"
    else:
        vulnerable_level = "기개입 상태 (진로 고민 T=1)"

    return {
        "id": int(data["ID"]),
        "happiness": int(data["X_happiness"]),
        "gender": "남성" if data["X_gender"] == 1 else "여성",
        "uplift_score": uplift,
        "segment": data["segment"],
        "vulnerable_level": vulnerable_level,
    }

# 4. Claude LLM 실시간 상담 가이드 생성 요청
class LLMRequest(BaseModel):
    student_id: int
    api_key: str

@app.post("/api/student/llm-guide")
def generate_llm_guide(req: LLMRequest):
    df = load_data()
    student_row = df[df['ID'] == req.student_id]
    if student_row.empty:
        raise HTTPException(status_code=404, detail="학생 정보가 없습니다.")

    data = student_row.iloc[0]

    uplift = float(data["uplift_score"])
    t_val = int(data["T"])
    t0_scores = df.loc[df['T'] == 0, 'uplift_score']
    cutoff_5 = t0_scores.quantile(0.05)
    cutoff_10 = t0_scores.quantile(0.10)
    cutoff_20 = t0_scores.quantile(0.20)

    if t_val == 0:
        if uplift <= cutoff_5:
            vulnerable_level = "최고 위험 (Level 3 - 즉각 개입)"
        elif uplift <= cutoff_10:
            vulnerable_level = "고위험 (Level 2 - 집중 관리)"
        elif uplift <= cutoff_20:
            vulnerable_level = "경계 (Level 1 - 적극 모니터링)"
        else:
            vulnerable_level = "정서적 자율 통제 상태"
    else:
        vulnerable_level = "기개입 상태 (진로 고민 T=1)"

    try:
        client = Anthropic(api_key=req.api_key)
        segment = data['segment']

        segment_context = {
            '인과적 위기 취약군 (Vulnerables)': f'진로 고민이 없는 현재 상태(T=0)임에도 위기 전이 데미지 점수({uplift:.4f})가 전체 하위 20%에 해당함. 즉, 진로 고민이 발생할 경우 성적 스트레스로 도미노처럼 번질 위험이 가장 높은 사각지대 핵심 타겟.',
            '자율 안심군 (Sure Things)': f'개입 없이도 성적 스트레스를 스스로 통제하는 회복탄력성이 높은 학생. 위기 전이 점수({uplift:.4f})가 0에 가까워 정서적 완충 능력이 우수함.',
            '장기 만성 위기군 (Lost Causes)': f'이미 진로 고민(T=1)을 겪고 있으며 성적 스트레스도 극심한 만성 위기 학생. 단순 격려보다 Wee Class 심층 진단 및 다각도 복지 개입이 필요함.',
            '기타관리군': f'현재 급성 위기는 아니나 인과 점수({uplift:.4f}) 모니터링이 필요한 관찰 대상군.',
        }.get(segment, '')

        prompt = f"""
        너는 KEEP II(한국교육고용패널) 데이터 기반 인과추론 AI 시스템 'Edu-Causal Compass'와 연동된 전국 최고 권위의 고등학교 교육 심리 및 상담 교사야.
        인과추론 모델(EconML CausalForestDML)의 위기 전이(Risk Spreading) 모델 분석 결과를 바탕으로, 이 학생을 위한 맞춤형 상담 솔루션 리포트를 한글로 품격 있고 설득력 있게 작성해줘.

        [인과추론 위기 전이 모델의 핵심 로직 개요]
        - 진로 및 진학 고민(개입 T=1)은 학생들에게 정서적 위기로 작용합니다. 이 위기가 들어왔을 때 고3 당시 성적 스트레스를 조절 및 완화(Y=1)하지 못하도록 방해하는 '인과적 데미지'가 바로 음수(-) 영역의 Uplift Score입니다.
        - 점수가 0에 가까울수록 진로 고민이 들어와도 스트레스를 스스로 제어할 수 있는 '회복탄력성이 높은 안심군'입니다.
        - 반대로 점수가 음수(-)로 가장 깊을수록(하위 20%), 진로 고민이 조금만 침투해도 스트레스로 도미노처럼 확산되어 학생 정서 전체가 붕괴되는 '인과적 위기 취약군'입니다.
        - 현재 미개입 상태(T=0)인 학생들 중 이 데미지가 가장 심각한 하위 20%를 '사각지대 핵심 타겟'으로 정의하여 예산을 집중 배정합니다.

        [대상 학생 인과 프로필]
        - 학생 고유 ID: {data['ID']}
        - 성별: {'남성' if data['X_gender']==1 else '여성'}
        - 고2 주관적 행복도: {data['X_happiness']}점 / 10점
        - AI 인과 분류 군집: {segment}
        - 위기 전이 데미지 점수 (Uplift Score): {uplift:.4f}
        - 인과적 위기 분석 등급: {vulnerable_level}
        - 군집 해석 및 맥락: {segment_context}

        [출력 양식 — 반드시 아래 3개 대주제로 구성하고, 마크다운 문법으로 미려하게 작성해줘]

        ## 🎯 1. 인과적 위기 요인 정밀 진단
        - 학생의 성별, 행복도, 인과 점수({uplift:.4f}) 및 위기 분석 등급({vulnerable_level}) 데이터를 근거로 제시하며, 이 학생의 정서적 도미노 전이 취약성에 대해 2~3문장으로 날카롭고 설득력 있는 정밀 교육학적 분석을 제시하세요.

        ## 💬 2. 담임교사용 실전 대화 시나리오 (오프닝 & 공감 코칭)
        - 베테랑 교사로서 학생을 Wee Class나 교무실로 조용히 불러 자연스럽고 따뜻하게 대화를 여는 구어체 스크립트입니다.
        - 권위적인 어조는 배제하고, "요즘 고민이 부쩍 많아졌지?"와 같이 학생의 눈높이에서 정서적 장벽을 허무는 자연스러운 발화체로 작성해 주세요.

        ## 📱 3. 학부모 발송용 밀착 안심 문자 초안
        - 가정과의 연대를 공고히 하기 위해 담임교사가 학부모에게 발송할 안심 안내 문자입니다.
        - 따뜻하고 구체적인 문장으로 작성하며, 학교에서 정교한 AI 기반 진단으로 학생의 보이지 않는 학업 및 진로 스트레스 취약군을 선제 발굴하여 정성껏 지도하고 있음을 전해 신뢰감을 심어주세요. (줄바꿈 포함 100자~150자 내외)
        """

        message = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=4096,
            temperature=0.7,
            messages=[{"role": "user", "content": prompt}],
        )
        return {"guide": message.content[0].text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Claude API 호출 실패: {str(e)}")

# 헬스 체크
@app.get("/api/health")
def health():
    return {"status": "ok", "data_loaded": os.path.exists(DATA_PATH)}

# 📂 로컬 개발용 정적 파일 라우트
# - Vercel 배포 환경에서는 정적 파일이 Vercel CDN으로 직접 서빙되어 이 라우트에 도달하지 않음
# - 로컬에서 `python server.py`로 실행 시 동일 포트에서 SPA를 서빙하기 위함
@app.get("/")
def read_index():
    return FileResponse(os.path.join(PROJECT_ROOT, "index.html"))

@app.get("/style.css")
def read_css():
    return FileResponse(os.path.join(PROJECT_ROOT, "style.css"))

@app.get("/app.js")
def read_js():
    return FileResponse(os.path.join(PROJECT_ROOT, "app.js"))
