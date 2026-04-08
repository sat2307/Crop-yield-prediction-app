from flask import Flask, render_template, request, jsonify
import joblib, json, pandas as pd, os
from operator import itemgetter

# --------------------------------------------
# PATH CONFIGURATION
# --------------------------------------------
BASE_DIR = os.path.dirname(__file__)
MODEL_PATH = os.path.join(BASE_DIR, "models", "final_crop_model.pkl")
META_PATH = os.path.join(BASE_DIR, "models", "metadata.json")
CSV_PATH = os.path.join(BASE_DIR, "cropdata.csv")

# --------------------------------------------
# BUILD METADATA FROM CSV
# --------------------------------------------
def build_meta_from_csv(csv_path):
    """Rebuild metadata dynamically from the given cropdata.csv file."""
    df = pd.read_csv(csv_path)
    pest_cols = [c for c in df.columns if c.startswith("Pest_Q")]
    rain_cols = [c for c in df.columns if c.startswith("Rainfall_Q")]
    temp_cols = [c for c in df.columns if c.startswith("Temp_Q")]

    # Available villages and crops
    villages = sorted(df["Village"].dropna().unique().tolist()) if "Village" in df.columns else []
    village_info = {v: sorted(df[df["Village"] == v]["Crop"].dropna().unique().tolist()) for v in villages}

    # Median pest per (village, crop)
    median_pest = {}
    if pest_cols and "Village" in df.columns and "Crop" in df.columns:
        med = df.groupby(["Village", "Crop"])[pest_cols].median().reset_index()
        for _, row in med.iterrows():
            key = f"{row['Village']}||{row['Crop']}"
            median_pest[key] = {c: float(row[c]) for c in pest_cols}

    # Mean weather per village
    weather_stats = {}
    if rain_cols and temp_cols:
        group = df.groupby("Village")[rain_cols + temp_cols].mean().reset_index()
        for _, row in group.iterrows():
            weather_stats[row["Village"]] = {c: round(float(row[c]), 2) for c in rain_cols + temp_cols}

    meta = {
        "pest_cols": pest_cols,
        "rain_cols": rain_cols,
        "temp_cols": temp_cols,
        "available_villages": villages,
        "village_info": village_info,
        "pest_medians": median_pest,
        "weather_stats": weather_stats,
        "features": rain_cols + temp_cols + pest_cols + ["Crop", "Village"],
    }

    # Auto-save updated metadata for future use
    try:
        os.makedirs(os.path.dirname(META_PATH), exist_ok=True)
        with open(META_PATH, "w") as f:
            json.dump(meta, f, indent=4)
    except Exception as e:
        print(f"[WARN] Could not save metadata.json: {e}")

    return meta


# --------------------------------------------
# LOAD MODEL + METADATA
# --------------------------------------------
model = None
meta = None

if os.path.exists(MODEL_PATH) and os.path.exists(META_PATH):
    try:
        model = joblib.load(MODEL_PATH)
        with open(META_PATH) as f:
            meta = json.load(f)

        # Ensure weather_stats is always present
        if "weather_stats" not in meta:
            meta["weather_stats"] = build_meta_from_csv(CSV_PATH)["weather_stats"]

    except Exception as e:
        print(f"[ERROR] Failed to load model or metadata: {e}")
        meta = build_meta_from_csv(CSV_PATH)

elif os.path.exists(CSV_PATH):
    meta = build_meta_from_csv(CSV_PATH)
else:
    meta = {
        "pest_cols": ["Pest_Q1", "Pest_Q2", "Pest_Q3", "Pest_Q4"],
        "rain_cols": ["Rainfall_Q1", "Rainfall_Q2", "Rainfall_Q3", "Rainfall_Q4"],
        "temp_cols": ["Temp_Q1", "Temp_Q2", "Temp_Q3", "Temp_Q4"],
        "available_villages": [],
        "village_info": {},
        "pest_medians": {},
        "weather_stats": {},
        "features": [],
    }

# --------------------------------------------
# FLASK APP SETUP
# --------------------------------------------
app = Flask(__name__, template_folder="templates")

# --------------------------------------------
# ROUTES
# --------------------------------------------
@app.route("/")
def index():
    """Home page — select village."""
    villages = sorted(meta.get("available_villages", []))
    return render_template("index.html", villages=villages)


@app.route("/get_weather/<village>")
def get_weather(village):
    """Return JSON weather data for a selected village."""
    weather = meta.get("weather_stats", {}).get(village, {})
    return jsonify(weather)


# --------------------------------------------
# HELPER FUNCTIONS
# --------------------------------------------
def build_input_row(forecast, crop, village, pest_values):
    """Construct a single prediction input row."""
    row = {}
    for k, v in forecast.items():
        row[k] = v
    for pcol, val in pest_values.items():
        row[pcol] = val
    row["Crop"] = crop
    row["Village"] = village
    return row


def safe_pct_change(base, new):
    """Return percent change (new-base)/base*100 safely."""
    try:
        if base == 0:
            return None
        return (new - base) / base * 100.0
    except Exception:
        return None


# --------------------------------------------
# RECOMMENDATION ROUTE (CORE LOGIC)
# --------------------------------------------
@app.route("/recommend", methods=["POST"])
def recommend():
    """Core recommendation + sensitivity + visualization data."""
    if model is None:
        return "Model not found. Please run train_model.py first."

    data = request.form.to_dict()
    village = data.get("village")

    # Use village-level mean weather
    forecast = meta["weather_stats"].get(village, {})
    if not forecast:
        df = pd.read_csv(CSV_PATH)
        forecast = df[meta["rain_cols"] + meta["temp_cols"]].mean().to_dict()

    results = []
    crops = meta["village_info"].get(village, [])
    global_pest = {p: 0.0 for p in meta["pest_cols"]}
    feature_list = meta["rain_cols"] + meta["temp_cols"] + meta["pest_cols"]

    for crop in crops:
        key = f"{village}||{crop}"
        pest_vals = meta["pest_medians"].get(key, global_pest)

        # Base prediction
        base_row = build_input_row(forecast, crop, village, pest_vals)
        base_df = pd.DataFrame([base_row])
        base_yield = float(model.predict(base_df)[0])

        # +20% / -20% pesticide
        more_pest = {p: (pest_vals.get(p, 0.0) * 1.2) for p in meta["pest_cols"]}
        less_pest = {p: (pest_vals.get(p, 0.0) * 0.8) for p in meta["pest_cols"]}
        yield_pest_plus = float(model.predict(pd.DataFrame([build_input_row(forecast, crop, village, more_pest)]))[0])
        yield_pest_minus = float(model.predict(pd.DataFrame([build_input_row(forecast, crop, village, less_pest)]))[0])

        # +10% / -10% weather
        more_weather = {k: v * 1.1 for k, v in forecast.items()}
        less_weather = {k: v * 0.9 for k, v in forecast.items()}
        yield_weather_plus = float(model.predict(pd.DataFrame([build_input_row(more_weather, crop, village, pest_vals)]))[0])
        yield_weather_minus = float(model.predict(pd.DataFrame([build_input_row(less_weather, crop, village, pest_vals)]))[0])

        # Percent deltas
        pct_pest_plus = safe_pct_change(base_yield, yield_pest_plus)
        pct_pest_minus = safe_pct_change(base_yield, yield_pest_minus)
        pct_weather_plus = safe_pct_change(base_yield, yield_weather_plus)
        pct_weather_minus = safe_pct_change(base_yield, yield_weather_minus)

        # Sensitivity analysis (+5% feature bump)
        feature_effects = []
        for feat in feature_list:
            temp_row = base_row.copy()
            base_val = temp_row.get(feat, 0.0)
            bump_val = base_val * 1.05 if base_val != 0 else 1.0
            temp_row[feat] = bump_val
            new_y = float(model.predict(pd.DataFrame([temp_row]))[0])
            delta = new_y - base_yield
            pct = round((delta / base_yield * 100.0), 3) if base_yield != 0 else 0
            feature_effects.append((feat, round(delta, 4), pct))

        feature_effects_sorted = sorted(feature_effects, key=itemgetter(1), reverse=True)
        top_positive = feature_effects_sorted[:3]
        top_negative = sorted([f for f in feature_effects_sorted if f[1] < 0], key=itemgetter(1))[:3]

        total_pest = sum([pest_vals.get(p, 0.0) for p in meta["pest_cols"]])

        results.append({
            "crop": crop,
            "predicted_yield": base_yield,
            "total_pesticide": float(total_pest),
            "pest_per_quarter": pest_vals,
            "yield_pest_plus": yield_pest_plus,
            "yield_pest_minus": yield_pest_minus,
            "yield_weather_plus": yield_weather_plus,
            "yield_weather_minus": yield_weather_minus,
            "pct_pest_plus": pct_pest_plus,
            "pct_pest_minus": pct_pest_minus,
            "pct_weather_plus": pct_weather_plus,
            "pct_weather_minus": pct_weather_minus,
            "top_positive_factors": top_positive,
            "top_negative_factors": top_negative,
        })

    # Sort crops by predicted yield
    results.sort(key=lambda x: x["predicted_yield"], reverse=True)

    # Village average weather for footer
    v_stats = meta.get("weather_stats", {}).get(village, {})
    village_avg = {"avg_temp": None, "avg_rain": None}
    if v_stats:
        temps = [val for k, val in v_stats.items() if "Temp" in k]
        rains = [val for k, val in v_stats.items() if "Rain" in k]
        if temps:
            village_avg["avg_temp"] = round(sum(temps) / len(temps), 2)
        if rains:
            village_avg["avg_rain"] = round(sum(rains) / len(rains), 2)

    return render_template("results.html", village=village, forecast=forecast, results=results, village_avg=village_avg)


# --------------------------------------------
# MAIN ENTRY
# --------------------------------------------
if __name__ == "__main__":
    app.run(debug=True)