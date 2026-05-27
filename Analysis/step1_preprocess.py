import pandas as pd
import numpy as np
import os

print("="*60)
print("🎯 [Step 1] 데이터 전처리 및 마스터셋 구축 가동...")
print("="*60)

# 1. 데이터 파일 존재 여부 확인
file_2016 = "2016_data.xlsx"
file_2018 = "2018_data.xlsx"

if not os.path.exists(file_2016) or not os.path.exists(file_2018):
    print("❌ 에러: 폴더에 '2016_data.xlsx' 또는 '2018_data.xlsx' 파일이 없습니다!")
    print("현재 폴더 내 파일 목록:", os.listdir('.'))
    exit()

# 2. 데이터 파일 불러오기
print("1) 대용량 엑셀 데이터 로드 중... (시간이 조금 걸릴 수 있습니다)")
df_2016 = pd.read_excel(file_2016)
df_2018 = pd.read_excel(file_2018)

print(f"   - 2016년 원본 변수(열) 개수: {df_2016.shape[1]}개 / 데이터 행: {df_2016.shape[0]}개")
print(f"   - 2018년 원본 변수(열) 개수: {df_2018.shape[1]}개 / 데이터 행: {df_2018.shape[0]}개")

# 3. ID 열 이름 표준화 및 병합
# 첫 번째 열을 강제로 'ID'로 통일하여 매칭 오류 방지
df_2016.rename(columns={df_2016.columns[0]: 'ID'}, inplace=True)
df_2018.rename(columns={df_2018.columns[0]: 'ID'}, inplace=True)

print("\n2) 고유 학생 ID 기준 패널 추적 데이터 병합 중...")
df_master = pd.merge(df_2016, df_2018, on='ID', how='inner')
print(f"   - 두 연도 모두 응답하여 추적 성공한 학생 수: {len(df_master)}명")

# 4. 분석에 사용할 진짜 변수명 자동 매핑 (영문/한글 모두 지원)
x1_col = 'Y16S13001' if 'Y16S13001' in df_master.columns else '귀하는 얼마나 행복합니까?'
x2_col = 'Y16S13002' if 'Y16S13002' in df_master.columns else '성별은 무엇입니까?'
t_col = 'Y17SZ01006' if 'Y17SZ01006' in df_master.columns else '진학․진로 문제 고민'
y_col = 'Y17SZ01005' if 'Y17SZ01005' in df_master.columns else '공부․학교 성적 문제'

# 필요한 컬럼만 추출하여 가볍게 만들기
selected_cols = ['ID', x1_col, x2_col, t_col, y_col]
df_anal = df_master[selected_cols].copy()

# 직관적인 영문 변수명으로 변경
df_anal.columns = ['ID', 'X_happiness', 'X_gender', 'T_raw', 'Y_raw']

# 5. 결측치(빈칸) 행 전원 제거
df_anal.dropna(inplace=True)
print(f"   - 무응답 및 빈칸 제거 후 최종 유효 학생 수: {len(df_anal)}명")

# 6. 인과추론용 이진 데이터(0, 1) 변환
print("\n3) AI 모델링 지표 수치화 진행...")
# T (개입): 고등학교 때 진로 문제 고민이 심각/매우심각(4, 5점)했던 대상자 = 1, 아니면 0
df_anal['T'] = df_anal['T_raw'].apply(lambda x: 1 if x >= 4 else 0)

# Y (결과): 고3 시점에 성적 고민이 보통 이하(1, 2, 3점)로 완화 및 통제에 성공함 = 1, 여전히 심각(4, 5점) = 0
df_anal['Y'] = df_anal['Y_raw'].apply(lambda x: 1 if x <= 3 else 0)

# 7. 최종 결과물 중간 저장
output_filename = "step1_output.csv"
df_anal.to_csv(output_filename, index=False)

print("\n" + "="*60)
print(f"🎉 [Step 1 완료] 결과가 '{output_filename}' 파일로 저장되었습니다.")
print("="*60)
print(df_anal[['ID', 'X_happiness', 'X_gender', 'T', 'Y']].head())