
import pandas as pd
import os, joblib, json
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
import sklearn
from packaging import version

DATA_PATH = "cropdata.csv"
OUT_DIR = "models"
os.makedirs(OUT_DIR, exist_ok=True)

df = pd.read_csv(DATA_PATH)

pest_cols = [c for c in df.columns if c.startswith("Pest_Q")]
rain_cols = [c for c in df.columns if c.startswith("Rainfall_Q")]
temp_cols = [c for c in df.columns if c.startswith("Temp_Q")]

for c in ("Year","Harvest_Quarter"):
    if c in df.columns:
        df = df.drop(columns=[c])

df = df.dropna(subset=rain_cols + temp_cols + pest_cols + ["Village","Crop","Annual_Yield_hg_per_ha"])

median_pest = df.groupby(["Village","Crop"])[pest_cols].median().reset_index()
pest_medians = {}
for _, row in median_pest.iterrows():
    key = f"{row['Village']}||{row['Crop']}"
    pest_medians[key] = {c: float(row[c]) for c in pest_cols}

target = "Annual_Yield_hg_per_ha"
features = rain_cols + temp_cols + pest_cols + ["Crop", "Village"]
X = df[features].copy()
y = df[target].copy()

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.20, random_state=42)

numeric_features = rain_cols + temp_cols + pest_cols
categorical_features = ["Crop", "Village"]

numeric_transformer = Pipeline([("scaler", StandardScaler())])

if version.parse(sklearn.__version__) >= version.parse("1.4"):
    ohe = OneHotEncoder(handle_unknown="ignore", sparse_output=False)
else:
    ohe = OneHotEncoder(handle_unknown="ignore", sparse=False)

categorical_transformer = Pipeline([("onehot", ohe)])

preprocessor = ColumnTransformer([
    ("num", numeric_transformer, numeric_features),
    ("cat", categorical_transformer, categorical_features)
])

pipeline = Pipeline([
    ("pre", preprocessor),
    ("reg", GradientBoostingRegressor(n_estimators=300, max_depth=5, learning_rate=0.05, random_state=42))
])

pipeline.fit(X_train, y_train)

y_pred = pipeline.predict(X_test)
r2 = r2_score(y_test, y_pred)
mae = mean_absolute_error(y_test, y_pred)
rmse = mean_squared_error(y_test, y_pred, squared=False)
print(f"Model results: R2={r2:.4f}, MAE={mae:.2f}, RMSE={rmse:.2f}")

joblib.dump(pipeline, os.path.join(OUT_DIR, "final_crop_model.pkl"))
meta = {
    "pest_cols": pest_cols,
    "rain_cols": rain_cols,
    "temp_cols": temp_cols,
    "available_villages": sorted(df["Village"].unique().tolist()),
    "village_info": {v: sorted(df[df["Village"]==v]["Crop"].unique().tolist()) for v in df["Village"].unique()},
    "pest_medians": pest_medians,
    "features": features
}
with open(os.path.join(OUT_DIR, "metadata.json"), "w") as f:
    json.dump(meta, f, indent=2)
print("Saved model ->", os.path.join(OUT_DIR, "final_crop_model.pkl"))
print("Saved metadata ->", os.path.join(OUT_DIR, "metadata.json"))
