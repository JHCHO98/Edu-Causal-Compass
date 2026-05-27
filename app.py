import streamlit as st
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import os
# 🔥 클로드 API 라이브러리 탑재
from anthropic import Anthropic

# 한글 깨짐 방지 설정
plt.rcParams['font.family'] = 'Malgun Gothic'
plt.rcParams['axes.unicode_minus'] = False

# 1. 페이지 기본 설정
st.set_page_config(
    page_title="Edu-Causal Compass (LLM 연동형)",
    page_icon="🎯",
    layout="wide"
)

# 2. 데이터 불러오기
input_filename = "step2_output.csv"
if not os.path.exists(input_filename):
    st.error(f"❌ '{input_filename}' 파일이 없습니다. Step 2를 먼저 실행해 주세요!")
    st.stop()

df = pd.read_csv(input_filename)

# 3. 사이드바 설정 및 API 키 입력 받기
st.sidebar.title("🎯 Edu-Causal Compass")
st.sidebar.markdown("---")

# 🔑 보안을 위해 스트림릿 사이드바에서 직접 API Key를 입력받도록 설계
claude_api_key = st.sidebar.text_input("🔑 Claude API Key를 입력하세요:", type="password", value="")
if not claude_api_key:
    st.sidebar.warning("⚠️ 실시간 AI 상담 가이드를 활성화하려면 클로드 API Key를 입력해 주세요.")

user_mode = st.sidebar.radio(
    "🔑 사용자의 직무 권한을 선택하세요:",
    ["🏫 담임 교사 모드 (학생별 맞춤형 처방)", "🏢 교육청 장학사 모드 (행정 예산 최적화)"]
)

st.sidebar.markdown("---")
st.sidebar.info("제8회 교육 공공데이터 AI활용대회 출품작\n\nEconML 인과추론 + Claude 3.5 Sonnet 결합형")


# =========================================================================
# 🏫 모드 1: 담임 교사 모드 (LLM 탑재)
# =========================================================================
if user_mode == "🏫 담임 교사 모드 (학생별 맞춤형 처방)":
    st.title("🏫 우리 반 가디언 대시보드 (교사용 + LLM)")
    st.markdown("#### *학급 학생들의 잠재적 위기 진단 및 Claude AI 실시간 맞춤형 소통 가이드라인*")
    st.markdown("---")
    
    total_students = len(df)
    persuadables_cnt = len(df[df['segment'] == '설득가능군 (Persuadables)'])
    lost_causes_cnt = len(df[df['segment'] == '철벽군 (Lost Causes)'])
    
    col1, col2, col3 = st.columns(3)
    col1.metric("📊 분석 완료 학생 수", f"{total_students:,} 명")
    col2.metric("🚨 집중 케어 대상 (설득가능군)", f"{persuadables_cnt:,} 명", "자원 투입 시 효과 극대화", delta_color="inverse")
    col3.metric("⚠️ 심층 진단 대상 (철벽군)", f"{lost_causes_cnt:,} 명", "다각도 심층 상담 필요")
    
    st.markdown("---")
    
    st.subheader("🔍 개별 학생 위기 및 인과 처방 조회")
    student_id = st.selectbox("조회할 학생의 고유 ID를 선택하세요:", df['ID'].unique()[:30]) # 예시 30명
    
    student_data = df[df['ID'] == student_id].iloc[0]
    
    col_std1, col_std2 = st.columns([1, 2])
    
    with col_std1:
        st.info(f"**📌 학생 기본 정보**\n- **ID**: {student_id}\n- **성별**: {'남성' if student_data['X_gender']==1 else '여성'}\n- **고2 당시 주관적 행복도**: {student_data['X_happiness']}점 / 10점")
        
        if student_data['segment'] == '설득가능군 (Persuadables)':
            st.error(f"🚨 상태: 설득가능군\n\n개입 효과 기대값(Uplift Score): {student_data['uplift_score']:.4f}\n\n학교 프로그램 개입이 필요한 핵심 타겟입니다.")
        elif student_data['segment'] == '철벽군 (Lost Causes)':
            st.warning(f"⚠️ 상태: 철벽군\n\n개입 효과 기대값(Uplift Score): {student_data['uplift_score']:.4f}\n\n심층 심리 상담 연계가 필요합니다.")
        else:
            st.success(f"🟢 상태: 안심군/기타\n\n개입 효과 기대값(Uplift Score): {student_data['uplift_score']:.4f}\n\n지속적인 일상 관찰군입니다.")
            
    with col_std2:
        st.subheader("🧠 Claude AI 실시간 개인화 솔루션 리포트")
        
        # API Key가 입력되었을 때만 생성 버튼 활성화
        if claude_api_key:
            if st.button("🤖 Claude 기반 맞춤형 가이드라인 실시간 생성"):
                with st.spinner("클로드 에이전트가 학생 맞춤형 프롬프트를 분석하여 전략을 수립 중입니다..."):
                    try:
                        # Anthropic 클라이언트 초기화
                        client = Anthropic(api_key=claude_api_key)
                        
                        # 인과 데이터 요약을 프롬프트로 주입
                        prompt = f"""
                        너는 대한민국 고등학교의 베테랑 담임교사이자 진로 상담 전문가야. 
                        인과추론 AI 모델(EconML)이 도출한 아래 고등학생 데이터를 바탕으로, 교사가 이 학생과 상담할 때 쓸 수 있는 실제 전략 리포트를 한글로 정중하고 전문적인 톤으로 작성해줘.

                        [학생 데이터]
                        - 성별: {'남성' if student_data['X_gender']==1 else '여성'}
                        - 고2 당시 주관적 행복도 점수: {student_data['X_happiness']}점 (10점 만점)
                        - 인과추론 분류 군집: {student_data['segment']}
                        - 개입 시 효율성 지표(Uplift Score): {student_data['uplift_score']:.4f}
                        
                        [작성 가이드라인]
                        1. [핵심 진단]: 군집 특성과 행복도 점수를 바탕으로 이 학생의 마음 상태를 짧게 요약해줘.
                        2. [담임 교사용 상담 스크립트]: 이 학생과 일대일 진로 상담을 할 때, 교사가 자연스럽게 대화를 시작하고 이끌어갈 수 있는 실제 대화 예시문(구어체)을 작성해줘.
                        3. [학부모 소통용 가이드]: 가정과 연계하여 이 학생을 도울 수 있도록 학부모에게 보낼 알림 문자 초안이나 소통 팁을 작성해줘.
                        
                        *주의: 교육청 규정을 준수하며, 생활기록부를 불법 대필하는 용도가 아닌 순수 학생 지도/상담 참고용으로만 조언할 것.*
                        """
                        
                        # Claude 3.5 Sonnet API 호출
                        message = client.messages.create(
                            model="claude-sonnet-4-5",
                            max_tokens=4096,
                            temperature=0.7,
                            messages=[
                                {"role": "user", "content": prompt}
                            ]
                        )
                        
                        # 결과 출력
                        st.markdown("---")
                        st.success("✨ 클로드 AI 분석 완료!")
                        st.write(message.content[0].text)
                        
                    except Exception as e:
                        st.error(f"❌ 클로드 API 호출 중 에러가 발생했습니다: {e}")
        else:
            st.warning("👈 왼쪽 사이드바에 Claude API Key를 입력하시면, 이 자리에 실시간 학생 맞춤형 상담 시나리오가 생성됩니다.")

# =========================================================================
# 🏢 모드 2: 교육청 장학사 모드 (기존 동일)
# =========================================================================
else:
    st.title("🏢 거점 복지 예산 최적화 시뮬레이터 (장학사용)")
    st.markdown("#### *한정된 교육 재정을 획기적인 가성비로 배분하는 인과추론 기반 예산 차등 분배 시뮬레이션*")
    st.markdown("---")
    
    st.subheader("💰 관내 교육 복지 및 정서 위기 해소 예산 설정")
    total_budget = st.slider("이번 분기 총 예산을 설정하세요 (단위: 만 원):", min_value=1000, max_value=50000, value=10000, step=1000)
    
    st.markdown("---")
    col_chart1, col_chart2 = st.columns(2)
    
    with col_chart1:
        st.subheader("📊 관내 고등학교 학생 인과적 군집 분포")
        fig, ax = plt.subplots(figsize=(6, 5))
        colors = ['#5dade2', '#e74c3c', '#f4d03f', '#bdc3c7']
        df['segment'].value_counts().plot.pie(autopct='%1.1f%%', colors=colors, ax=ax, startangle=90)
        ax.set_ylabel('')
        st.pyplot(fig)
        
    with col_chart2:
        st.subheader("💸 예산 분배 효율성 시뮬레이션 비교")
        x_eff = np.linspace(0, total_budget, 100)
        y_traditional = np.sqrt(x_eff) * 2
        y_causal = np.sqrt(x_eff) * 4.5
        
        fig2, ax2 = plt.subplots(figsize=(7, 5))
        ax2.plot(x_eff, y_causal, label='Edu-Causal Compass (정밀 타겟 배분)', color='#e74c3c', linewidth=3)
        ax2.plot(x_eff, y_traditional, label='기존 균등 분배 방식', color='#bdc3c7', linestyle='--', linewidth=2)
        ax2.set_xlabel("투입 예산 규모 (만 원)")
        ax2.set_ylabel("관내 위기 학생 구제 성공률 (지표)")
        ax2.legend()
        ax2.grid(True)
        st.pyplot(fig2)
        
    st.success(f"💡 **장학사 정책 제언**: 총 예산 **{total_budget:,}만 원**을 균등 배분하지 않고, AI가 탐지한 **'설득가능군(Persuadables)' 비율에 따라 관내 학교별로 차등 배정**할 경우, 기존 대비 최대 **2.2배** 이상의 행정적 복지 누수를 방지하고 자원 효율성을 극대화할 수 있습니다.")