import pandas as pd
import numpy as np
import os
from econml.dml import CausalForestDML
from sklearn.ensemble import RandomForestRegressor

print("="*60)
print("🧠 [Step 2 수정본] Causal Forest 스코어 튜닝 및 군집 재분류 가동...")
print("="*60)

input_filename = "step1_output.csv"
output_filename = "step2_output.csv"

if not os.path.exists(input_filename):
    print(f"❌ 에러: [{input_filename}] 파일이 없습니다! Step 1을 먼저 완료해 주세요.")
    exit()

df_anal = pd.read_csv(input_filename)
X_matrix = df_anal[['X_happiness', 'X_gender']].values
T_vector = df_anal['T'].values
Y_vector = df_anal['Y'].values

# 모델 학습
est = CausalForestDML(
    model_y=RandomForestRegressor(n_estimators=100, max_depth=5, random_state=42),
    model_t=RandomForestRegressor(n_estimators=100, max_depth=5, random_state=42),
    discrete_treatment=True,
    random_state=42
)
est.fit(Y_vector, T_vector, X=X_matrix)

# 스코어 산출
uplift_scores = est.effect(X_matrix)
df_anal['uplift_score'] = uplift_scores

# ---------------------------------------------------------
# 🔥 [긴급 수정 핵심] 상대적 임계치 설정 (상위 20% 경계선 찾기)
# ---------------------------------------------------------
# 미개입 학생(T==0)들 중 개입 효과 효율이 상위 20%인 점수의 커트라인을 계산합니다.
t0_scores = df_anal[df_anal['T'] == 0]['uplift_score']
threshold = np.percentile(t0_scores, 80) # 상위 20% 커트라인 점수
print(f"▶ 미개입 학생 중 개입 효율 상위 20% 커트라인 점수: {threshold:.4f}")

def classify_segment_fixed(row):
    # 개입을 받지 않았고, 개입했을 때의 효율(Uplift)이 상위 20%인 사각지대 학생
    if row['T'] == 0 and row['uplift_score'] >= threshold:
        return '설득가능군 (Persuadables)'  # 복지 예산 투입 1순위 핵심 타겟!
    elif row['Y'] == 1 and row['T'] == 0:
        return '안심군 (Sure Things)'        # 지원 없이도 스스로 잘 극복하는 학생
    elif row['Y'] == 0 and row['T'] == 1:
        return '철벽군 (Lost Causes)'       # 개입을 받았으나 효과가 미미해 다각도 재진단 필요 학생
    else:
        return '기타관리군'

df_anal['segment'] = df_anal.apply(classify_segment_fixed, axis=1)

# 최종 결과 파일 덮어쓰기 저장
df_anal.to_csv(output_filename, index=False)

print("\n" + "="*60)
print(f"🎉 [Step 2 수정 완료] 결과가 '{output_filename}' 파일로 업데이트되었습니다.")
print("="*60)

print("\n📊 [업데이트된 군집 분류 결과 통계]")
print(df_anal['segment'].value_counts())

print("\n🔍 수정된 결과 샘플 미리보기:")
print(df_anal[['ID', 'uplift_score', 'segment']].head(10))