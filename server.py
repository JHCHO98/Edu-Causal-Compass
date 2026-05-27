from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import pandas as pd
import os
from anthropic import Anthropic

app = FastAPI(title="Edu-Causal Compass API", version="1.0")

# 🔒 프론트엔드(React)와의 연동을 위한 CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # 실전에서는 React 주소만 허용 (예: http://localhost:5173)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_PATH = "step2_output.csv"

def reclassify_segments(df: pd.DataFrame) -> pd.DataFrame:
    """★ 핵심 로직: 인과적 위기 전이(Risk Spreading) 모델 기반 4대 군집 동적 재분류
    - 모든 uplift_score는 음수 영역에 존재 (진로 위기 → 성적 스트레스 전이 구조)
    - 하위 20%: 위기 전이 데미지가 극심한 '사각지대' 핵심 타겟
    - 0에 가까울수록: 회복탄력성 높은 자율 안심 학생
    """
    df = df.copy()
    # T=0 학생들의 하위 20% uplift 커트라인 계산 (가장 음수 깊은 쪽)
    t0_scores = df.loc[df['T'] == 0, 'uplift_score']
    cutoff = t0_scores.quantile(0.20)

    def assign_segment(row):
        if row['T'] == 0 and row['uplift_score'] <= cutoff:
            # T=0 이면서 위기 전이 데미지 하위 20%: 사각지대 핵심 타겟
            return '인과적 위기 취약군 (Vulnerables)'
        elif row['T'] == 0 and row['Y'] == 1:
            # 개입 없이도 스스로 성적 스트레스를 통제하는 자율 안심군
            return '자율 안심군 (Sure Things)'
        elif row['T'] == 1 and row['Y'] == 0:
            # 이미 진로 고민 + 성적 스트레스 극심: 장기 만성 위기군
            return '장기 만성 위기군 (Lost Causes)'
        else:
            return '기타관리군'

    df['segment'] = df.apply(assign_segment, axis=1)
    return df

def load_data():
    if not os.path.exists(DATA_PATH):
        raise HTTPException(status_code=500, detail="AI 결과 데이터 파일이 존재하지 않습니다.")
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

    # T=0 하위 20% 커트라인 수치 노출 (대시보드 신뢰도 제고)
    t0_cutoff = float(df.loc[df['T'] == 0, 'uplift_score'].quantile(0.20))

    return {
        "total_students": total,
        "persuadables_count": vulnerables,
        "lost_causes_count": lost_causes,
        "sure_things_count": sure_things,
        "vulnerables_cutoff": round(t0_cutoff, 4)
    }

# 2. 학생 목록 조회 API — 위기 취약군 최우선 정렬 후 50명 샘플
@app.get("/api/students")
def get_students():
    df = load_data()
    # 위기 취약군: uplift 오름차순(가장 음수 먼저), 나머지: uplift 내림차순
    vulnerables = df[df['segment'] == '인과적 위기 취약군 (Vulnerables)'].sort_values('uplift_score')
    others = df[df['segment'] != '인과적 위기 취약군 (Vulnerables)'].sort_values('uplift_score', ascending=False)
    sample = pd.concat([vulnerables, others]).head(50)[['ID', 'segment']]
    return {"students": sample.to_dict(orient="records")}

# 3. 개별 학생 상세 정보 조회 API
@app.get("/api/student/{student_id}")
def get_student_detail(student_id: int):
    df = load_data()
    student_row = df[df['ID'] == student_id]
    if student_row.empty:
        raise HTTPException(status_code=404, detail="해당 학생을 찾을 수 없습니다.")
    
    data = student_row.iloc[0].to_dict()
    return {
        "id": int(data["ID"]),
        "happiness": int(data["X_happiness"]),
        "gender": "남성" if data["X_gender"] == 1 else "여성",
        "uplift_score": float(data["uplift_score"]),
        "segment": data["segment"]
    }

# 4. Claude LLM 실시간 상담 가이드 생성 요청 구조
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
    
    try:
        client = Anthropic(api_key=req.api_key)
        segment = data['segment']
        uplift = float(data['uplift_score'])
        # 군집별 맥락 설명 (Claude가 더 정확한 리포트를 생성하도록)
        segment_context = {
            '인과적 위기 취약군 (Vulnerables)': f'진로 고민이 없는 현재 상태(T=0)임에도 위기 전이 데미지 점수({uplift:.4f})가 전체 하위 20%에 해당함. 즉, 진로 고민이 발생할 경우 성적 스트레스로 도미노처럼 번질 위험이 가장 높은 사각지대 핵심 타겟.',
            '자율 안심군 (Sure Things)': f'개입 없이도 성적 스트레스를 스스로 통제하는 회복탄력성이 높은 학생. 위기 전이 점수({uplift:.4f})가 0에 가까워 정서적 완충 능력이 우수함.',
            '장기 만성 위기군 (Lost Causes)': f'이미 진로 고민(T=1)을 겪고 있으며 성적 스트레스도 극심한 만성 위기 학생. 단순 격려보다 Wee Class 심층 진단 및 다각도 복지 개입이 필요함.',
            '기타관리군': f'현재 급성 위기는 아니나 인과 점수({uplift:.4f}) 모니터링이 필요한 관찰 대상군.',
        }.get(segment, '')

        prompt = f"""
        너는 KEEP II(한국교육고용패널) 데이터 기반 인과추론 AI 시스템 'Edu-Causal Compass'와 연동된 고등학교 베테랑 상담 교사야.
        인과추론 모델(EconML CausalForestDML)의 분석 결과를 바탕으로, 이 학생을 위한 맞춤형 상담 리포트를 한글로 작성해줘.

        [학생 인과 프로필]
        - ID: {data['ID']}
        - 성별: {'남성' if data['X_gender']==1 else '여성'}
        - 고2 주관적 행복도: {data['X_happiness']}점 / 10점
        - AI 인과 군집: {segment}
        - 위기 전이 데미지 점수 (Uplift Score): {uplift:.4f}
        - 군집 해석: {segment_context}

        [출력 양식 — 반드시 아래 3개 섹션으로 구성]
        1. 🎯 인과적 위기 요인 진단 (2~3문장, 데이터 근거 포함)
        2. 💬 담임교사용 실전 대화 오프닝 (구어체, 학생 눈높이에 맞게 자연스럽게)
        3. 📱 학부모 발송용 안심 안내 문자 초안 (따뜻하고 구체적으로, 100자 내외)
        """
        
        message = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=4096,
            temperature=0.7,
            messages=[{"role": "user", "content": prompt}]
        )
        return {"guide": message.content[0].text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Claude API 호출 실패: {str(e)}")

# 📂 프론트엔드 정적 파일 서빙 라우트
@app.get("/")
def read_index():
    return FileResponse("index.html")

@app.get("/style.css")
def read_css():
    return FileResponse("style.css")

@app.get("/app.js")
def read_js():
    return FileResponse("app.js")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)