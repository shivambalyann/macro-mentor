# app.py
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
from utils import calculate_bmr, calculate_daily_calories, calculate_macros, load_foods_from_csv, generate_meal_plan_df

# Base directory (project root)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, 'data', 'foods.csv')

app = Flask(__name__)
CORS(app)

# Load foods once
FOODS_DF = load_foods_from_csv(DATA_PATH)

@app.route('/api/foods', methods=['GET'])
def api_foods():
    foods = FOODS_DF[['food','calories','protein','type']].to_dict('records')
    return jsonify({'status':'ok','foods':foods})

@app.route('/api/generate', methods=['POST'])
def api_generate():
    data = request.get_json() or {}

    try:
        weight = float(data.get('weight', 70))
        height = float(data.get('height', 170))
        age = int(data.get('age', 25))
        gender = data.get('gender', 'other')
        activity = data.get('activity', 'moderately active')
        goal = data.get('goal', 'maintenance')
        prot_multiplier = float(data.get('prot_multiplier', 1.8))
        diet = data.get('diet', 'non-vegetarian')
    except Exception as e:
        return jsonify({'status':'error','message':'Invalid inputs','detail':str(e)}), 400

    # Core calculations
    bmr = calculate_bmr(weight, height, age, gender)
    daily_cal = calculate_daily_calories(bmr, activity, goal)
    protein_target = prot_multiplier * weight
    macros = calculate_macros(daily_cal, protein_target)

    # Filter food by diet
    if diet == 'vegetarian':
        food_df = FOODS_DF[FOODS_DF['type'] == 'vegetarian'].copy()
    else:
        food_df = FOODS_DF.copy()

    plan, totals, note = generate_meal_plan_df(food_df, daily_cal, macros['protein_g'])

    response = {
        'status': 'ok',
        'inputs': {
            'weight': weight, 'height': height, 'age': age,
            'gender': gender, 'activity': activity, 'goal': goal,
            'prot_multiplier': prot_multiplier, 'diet': diet
        },
        'bmr': bmr,
        'daily_calories': daily_cal,
        'macros': macros,
        'plan': plan,
        'totals': totals,
        'note': note
    }
    return jsonify(response)

@app.route('/api/export_csv', methods=['POST'])
def api_export_csv():
    data = request.get_json() or {}
    plan = data.get('plan', [])
    if not plan:
        return jsonify({'status':'error','message':'No plan to export'}), 400

    import csv
    from io import StringIO, BytesIO
    csv_io = StringIO()
    writer = csv.writer(csv_io)
    writer.writerow(['food','servings','calories','protein_g'])

    for p in plan:
        writer.writerow([
            p.get('food'),
            p.get('servings'),
            p.get('calories'),
            p.get('protein')
        ])

    mem = BytesIO()
    mem.write(csv_io.getvalue().encode('utf-8'))
    mem.seek(0)
    return send_file(
        mem,
        mimetype='text/csv',
        as_attachment=True,
        download_name='meal_plan.csv'
    )

# ================================
# AUTO OPEN BROWSER ON START
# ================================
def open_browser():
    import webbrowser
    import time

    time.sleep(1)  # give Flask a moment to start

    # ---------- <<< THIS PATH MATCHES YOUR PROJECT SHOWN IN THE SCREENSHOT >>> ----------
    # index.html is at: C:\PROJECT\DSP\index.html
    url = "file:///C:/PROJECT/DSP/index.html"

    # Try to open Chrome specifically (common Windows path), otherwise fall back to default browser
    chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    chrome_path_alt = r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    try:
        if os.path.exists(chrome_path):
            webbrowser.register('chrome', None, webbrowser.BackgroundBrowser(chrome_path))
            webbrowser.get('chrome').open(url)
        elif os.path.exists(chrome_path_alt):
            webbrowser.register('chrome', None, webbrowser.BackgroundBrowser(chrome_path_alt))
            webbrowser.get('chrome').open(url)
        else:
            # fallback
            webbrowser.open(url)
    except Exception:
        webbrowser.open(url)

if __name__ == '__main__':
    import threading
    threading.Thread(target=open_browser, daemon=True).start()
    # run Flask
    app.run(debug=True, port=5000)
